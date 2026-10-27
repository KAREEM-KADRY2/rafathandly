const db = require('../db');
const auditLogger = require('./auditLogger');

// Ensure optional treasury linkage columns exist in opening_balances
try {
    const cols = db.prepare("PRAGMA table_info(opening_balances)").all().map(c => c.name);
    if (!cols.includes('account_id')) {
        db.prepare("ALTER TABLE opening_balances ADD COLUMN account_id INTEGER").run();
    }
    if (!cols.includes('treasury_tx_id')) {
        db.prepare("ALTER TABLE opening_balances ADD COLUMN treasury_tx_id INTEGER").run();
    }
} catch (e) {
    console.error('Migration note for opening_balances:', e.message);
}

function recalculateFinancialAccountBalance(accountId) {
    const row = db.prepare(`
        SELECT COALESCE(SUM(
            CASE 
                WHEN type = 'IN' THEN amount 
                WHEN type = 'OUT' THEN -amount 
                ELSE 0 
            END
        ), 0) as balance 
        FROM treasury_transactions 
        WHERE account_id = ?
    `).get(accountId);
    
    const newBal = row ? row.balance : 0;
    db.prepare('UPDATE financial_accounts SET balance = ? WHERE id = ?').run(newBal, accountId);
    return newBal;
}

function recalculateCustomerBalances(customerId) {
    const txs = db.prepare(`
        SELECT * FROM customer_account_transactions 
        WHERE customer_id = ? 
        ORDER BY datetime(transaction_date) ASC, id ASC
    `).all(customerId);

    let running = 0;
    const updateStmt = db.prepare('UPDATE customer_account_transactions SET balance_after = ? WHERE id = ?');
    
    for (const tx of txs) {
        if (tx.transaction_type === 'OPENING_BALANCE' || tx.transaction_type === 'SALE') {
            running += tx.amount;
        } else if (tx.transaction_type === 'PAYMENT' || tx.transaction_type === 'ZARA') {
            running -= Math.abs(tx.amount);
        } else {
            running += tx.amount;
        }
        updateStmt.run(running, tx.id);
    }
    return running;
}

function updateSupplierBalance(supplierId) {
    const supp = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supp) return 0;

    const isFactory = supp.type === 'مصنع';

    if (isFactory) {
        // Factory Prepaid Balance: Opening Balance + Deposits - Purchases
        const obRow = db.prepare("SELECT amount FROM opening_balances WHERE entity_type IN ('factory', 'supplier') AND entity_id = ?").get(supplierId);
        const openingPrepaid = obRow ? (Number(obRow.amount) || 0) : 0;

        // Factory deposits are payments to factory (amount > 0 adds to prepaid, amount < 0 is refund from factory)
        const depositsRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit'").get(supplierId);
        const totalDeposits = depositsRow ? depositsRow.total : 0;

        const purchasesRow = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE supplier_id = ? AND (status IS NULL OR status != 'CANCELLED')").get(supplierId);
        const totalPurchases = purchasesRow ? purchasesRow.total : 0;

        const currentPrepaid = openingPrepaid + totalDeposits - totalPurchases;
        db.prepare('UPDATE suppliers SET balance = ? WHERE id = ?').run(currentPrepaid, supplierId);
        return currentPrepaid;
    } else {
        // Material Supplier Payable: Opening Balance (credit is payable, debit is advance) + Purchases - Payments
        const obRow = db.prepare("SELECT balance_type, amount FROM opening_balances WHERE entity_type = 'supplier' AND entity_id = ?").get(supplierId);
        let openingPayable = 0;
        if (obRow) {
            openingPayable = obRow.balance_type === 'credit' ? (Number(obRow.amount) || 0) : -(Number(obRow.amount) || 0);
        }

        const purchasesRow = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE supplier_id = ? AND (status IS NULL OR status != 'CANCELLED')").get(supplierId);
        const totalPurchases = purchasesRow ? purchasesRow.total : 0;

        // Supplier payments in supplier_balance_transactions are stored with negative amounts (amount < 0)
        // Using SUM(ABS(amount)) ensures totalPayments is positive, so subtracting it correctly reduces the payable balance
        const paymentsRow = db.prepare("SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit'").get(supplierId);
        const totalPayments = paymentsRow ? paymentsRow.total : 0;

        const currentPayable = openingPayable + totalPurchases - totalPayments;
        db.prepare('UPDATE suppliers SET balance = ? WHERE id = ?').run(currentPayable, supplierId);
        return currentPayable;
    }
}

exports.getOpeningBalance = (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const ob = db.prepare('SELECT * FROM opening_balances WHERE entity_type = ? AND entity_id = ?').get(entityType, entityId);
        res.json(ob || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.saveOpeningBalance = (req, res) => {
    try {
        let { entity_type, entity_id, balance_type, amount, effective_date, notes, reference, account_id, affect_treasury } = req.body;

        if (!entity_type || !entity_id || !effective_date) {
            return res.status(400).json({ error: 'نوع الكيان، رقم الكيان، وتاريخ الرصيد الافتتاحي مطلوبين' });
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 0) {
            return res.status(400).json({ error: 'يرجى إدخال مبلغ رصيد افتتاحي صحيح (0 أو أكبر)' });
        }

        if (!['customer', 'supplier', 'factory', 'worker', 'treasury', 'financial_account'].includes(entity_type)) {
            return res.status(400).json({ error: 'نوع الكيان غير صحيح' });
        }

        if (!['debit', 'credit'].includes(balance_type)) {
            balance_type = 'debit';
        }

        // Entity verification
        let entityName = '';
        if (entity_type === 'customer') {
            const cust = db.prepare('SELECT name FROM customers WHERE id = ?').get(entity_id);
            if (!cust) return res.status(404).json({ error: 'العميل غير موجود' });
            entityName = cust.name;
        } else if (entity_type === 'supplier' || entity_type === 'factory') {
            const supp = db.prepare('SELECT name, type FROM suppliers WHERE id = ?').get(entity_id);
            if (!supp) return res.status(404).json({ error: 'المورد أو المصنع غير موجود' });
            entityName = supp.name;
        } else if (entity_type === 'worker') {
            const worker = db.prepare('SELECT name FROM workers WHERE id = ?').get(entity_id);
            if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });
            entityName = worker.name;
        } else if (entity_type === 'treasury' || entity_type === 'financial_account') {
            const acc = db.prepare('SELECT name FROM financial_accounts WHERE id = ?').get(entity_id);
            if (!acc) return res.status(404).json({ error: 'الحساب المالي غير موجود' });
            entityName = acc.name;
        }

        const existingOB = db.prepare('SELECT * FROM opening_balances WHERE entity_type = ? AND entity_id = ?').get(entity_type, entity_id);

        const transaction = db.transaction(() => {
            // Upsert opening_balances
            const upsertStmt = db.prepare(`
                INSERT INTO opening_balances (entity_type, entity_id, balance_type, amount, effective_date, notes, reference, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(entity_type, entity_id) DO UPDATE SET
                    balance_type = excluded.balance_type,
                    amount = excluded.amount,
                    effective_date = excluded.effective_date,
                    notes = excluded.notes,
                    reference = excluded.reference,
                    updated_at = CURRENT_TIMESTAMP
            `);
            upsertStmt.run(entity_type, entity_id, balance_type, numAmount, effective_date, notes || null, reference || null);

            // Synchronize with ledgers
            if (entity_type === 'customer') {
                // Delete existing opening balance transaction if any
                db.prepare("DELETE FROM customer_account_transactions WHERE customer_id = ? AND transaction_type = 'OPENING_BALANCE'").run(entity_id);
                
                if (numAmount > 0) {
                    const signedAmount = balance_type === 'debit' ? numAmount : -numAmount;
                    const dateFormatted = effective_date.includes('T') ? effective_date : `${effective_date} 00:00:00`;

                    db.prepare(`
                        INSERT INTO customer_account_transactions (customer_id, transaction_type, amount, balance_after, transaction_date, notes)
                        VALUES (?, 'OPENING_BALANCE', ?, ?, ?, ?)
                    `).run(entity_id, signedAmount, signedAmount, dateFormatted, notes || 'رصيد افتتاحي سابق لبدء استخدام النظام');
                }

                recalculateCustomerBalances(entity_id);
            } else if (entity_type === 'supplier') {
                // Delete existing opening balance transaction if any
                db.prepare("DELETE FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'opening_balance'").run(entity_id);

                if (numAmount > 0) {
                    const signedAmount = balance_type === 'credit' ? numAmount : -numAmount;
                    const dateFormatted = effective_date.includes('T') ? effective_date : `${effective_date} 00:00:00`;

                    db.prepare(`
                        INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at)
                        VALUES (?, ?, 'opening_balance', ?, ?, ?)
                    `).run(entity_id, signedAmount, reference || 'رصيد افتتاحي', notes || 'رصيد افتتاحي دائن للمورد', dateFormatted);
                }

                updateSupplierBalance(entity_id);
            } else if (entity_type === 'factory') {
                // Delete existing opening balance transaction if any
                db.prepare("DELETE FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'opening_balance'").run(entity_id);

                if (numAmount > 0) {
                    const dateFormatted = effective_date.includes('T') ? effective_date : `${effective_date} 00:00:00`;

                    db.prepare(`
                        INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at)
                        VALUES (?, ?, 'opening_balance', ?, ?, ?)
                    `).run(entity_id, numAmount, reference || 'رصيد مقدم افتتاحي', notes || 'رصيد مقدم افتتاحي للمصنع', dateFormatted);
                }

                updateSupplierBalance(entity_id);
            } else if (entity_type === 'treasury' || entity_type === 'financial_account') {
                // Delete existing opening balance transaction for this financial account if any
                db.prepare("DELETE FROM treasury_transactions WHERE account_id = ? AND (related_entity_type = 'OPENING_BALANCE' OR description LIKE 'رصيد افتتاحي%' OR description LIKE 'رصيد الدفتر%')").run(entity_id);

                if (numAmount > 0) {
                    const txType = balance_type === 'debit' ? 'IN' : 'OUT';
                    const dateFormatted = effective_date.includes('T') ? effective_date : `${effective_date} 00:00:00`;

                    db.prepare(`
                        INSERT INTO treasury_transactions 
                        (account_id, type, amount, date, description, related_entity_type, related_entity_id, user)
                        VALUES (?, ?, ?, ?, ?, 'OPENING_BALANCE', ?, 'مستخدم النظام')
                    `).run(entity_id, txType, numAmount, dateFormatted, notes || 'رصيد الدفتر', entity_id);
                }

                recalculateFinancialAccountBalance(entity_id);
            }

            // Optional Treasury Linkage for party entities (customer, supplier, factory, worker)
            if (['customer', 'supplier', 'factory', 'worker'].includes(entity_type)) {
                // Clean up previous treasury transaction if existing
                if (existingOB && existingOB.treasury_tx_id) {
                    const prevTx = db.prepare('SELECT account_id FROM treasury_transactions WHERE id = ?').get(existingOB.treasury_tx_id);
                    db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(existingOB.treasury_tx_id);
                    if (prevTx) recalculateFinancialAccountBalance(prevTx.account_id);
                }

                if (affect_treasury && account_id && numAmount > 0) {
                    const acc = db.prepare('SELECT id, name FROM financial_accounts WHERE id = ?').get(account_id);
                    if (acc) {
                        let txType = 'IN';
                        let desc = '';

                        if (entity_type === 'customer') {
                            txType = balance_type === 'credit' ? 'IN' : 'OUT';
                            desc = `رصيد افتتاحي للعميل (${entityName}) - ${balance_type === 'credit' ? 'دفعة مقدمة' : 'مديونية'}`;
                        } else if (entity_type === 'supplier') {
                            txType = balance_type === 'debit' ? 'OUT' : 'IN';
                            desc = `رصيد افتتاحي للمورد (${entityName}) - ${balance_type === 'debit' ? 'دفعة مقدمة' : 'مستحق'}`;
                        } else if (entity_type === 'factory') {
                            txType = 'OUT';
                            desc = `رصيد مقدم افتتاحي للمصنع (${entityName})`;
                        } else if (entity_type === 'worker') {
                            txType = balance_type === 'debit' ? 'OUT' : 'IN';
                            desc = `رصيد افتتاحي للعامل (${entityName}) - ${balance_type === 'debit' ? 'سلفة' : 'مستحق'}`;
                        }

                        const dateFormatted = effective_date.includes('T') ? effective_date : `${effective_date} 00:00:00`;
                        const ttRes = db.prepare(`
                            INSERT INTO treasury_transactions 
                            (account_id, type, amount, date, description, related_entity_type, related_entity_id, user, reference_type)
                            VALUES (?, ?, ?, ?, ?, 'OPENING_BALANCE', ?, 'مستخدم النظام', 'opening_balance')
                        `).run(acc.id, txType, numAmount, dateFormatted, desc, entity_id);

                        const newTtId = ttRes.lastInsertRowid;
                        db.prepare('UPDATE opening_balances SET account_id = ?, treasury_tx_id = ? WHERE entity_type = ? AND entity_id = ?')
                            .run(acc.id, newTtId, entity_type, entity_id);

                        recalculateFinancialAccountBalance(acc.id);
                    }
                } else {
                    db.prepare('UPDATE opening_balances SET account_id = NULL, treasury_tx_id = NULL WHERE entity_type = ? AND entity_id = ?')
                        .run(entity_type, entity_id);
                }
            }

            // Audit log
            auditLogger.logAction(
                'مستخدم النظام',
                existingOB ? 'UPDATE' : 'CREATE',
                'الرصيد الافتتاحي',
                entity_type.toUpperCase(),
                String(entity_id),
                `${existingOB ? 'تعديل' : 'إضافة'} رصيد افتتاحي لـ (${entityName}) بقيمة ${numAmount.toLocaleString()} ج.م بتاريخ ${effective_date}${affect_treasury && account_id ? ' (تم التأثير في الخزينة)' : ''}`,
                existingOB ? JSON.stringify(existingOB) : null,
                JSON.stringify({ entity_type, entity_id, balance_type, amount: numAmount, effective_date, notes, reference, account_id, affect_treasury })
            );
        });

        transaction();

        const updatedOB = db.prepare('SELECT * FROM opening_balances WHERE entity_type = ? AND entity_id = ?').get(entity_type, entity_id);
        res.json({
            message: existingOB ? 'تم تحديث الرصيد الافتتاحي بنجاح' : 'تم إضافة الرصيد الافتتاحي بنجاح',
            opening_balance: updatedOB
        });

    } catch (error) {
        console.error('Error saving opening balance:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteOpeningBalance = (req, res) => {
    try {
        const { entityType, entityId } = req.params;

        const existingOB = db.prepare('SELECT * FROM opening_balances WHERE entity_type = ? AND entity_id = ?').get(entityType, entityId);
        if (!existingOB) {
            return res.status(404).json({ error: 'لا يوجد رصيد افتتاحي مسجل لهذا الكيان' });
        }

        const transaction = db.transaction(() => {
            // If linked to a treasury transaction, delete it and recalculate
            if (existingOB.treasury_tx_id) {
                const prevTx = db.prepare('SELECT account_id FROM treasury_transactions WHERE id = ?').get(existingOB.treasury_tx_id);
                db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(existingOB.treasury_tx_id);
                if (prevTx) recalculateFinancialAccountBalance(prevTx.account_id);
            }

            db.prepare('DELETE FROM opening_balances WHERE entity_type = ? AND entity_id = ?').run(entityType, entityId);

            if (entityType === 'customer') {
                db.prepare("DELETE FROM customer_account_transactions WHERE customer_id = ? AND transaction_type = 'OPENING_BALANCE'").run(entityId);
                recalculateCustomerBalances(entityId);
            } else if (entityType === 'supplier' || entityType === 'factory') {
                db.prepare("DELETE FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'opening_balance'").run(entityId);
                updateSupplierBalance(entityId);
            } else if (entityType === 'treasury' || entityType === 'financial_account') {
                db.prepare("DELETE FROM treasury_transactions WHERE account_id = ? AND (related_entity_type = 'OPENING_BALANCE' OR description LIKE 'رصيد افتتاحي%' OR description LIKE 'رصيد الدفتر%')").run(entityId);
                recalculateFinancialAccountBalance(entityId);
            }

            auditLogger.logAction(
                'مستخدم النظام',
                'DELETE',
                'الرصيد الافتتاحي',
                entityType.toUpperCase(),
                String(entityId),
                `حذف الرصيد الافتتاحي للكيان رقم ${entityId}`,
                JSON.stringify(existingOB),
                null
            );
        });

        transaction();
        res.json({ message: 'تم حذف الرصيد الافتتاحي بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSupplierBalance = updateSupplierBalance;
exports.recalculateFinancialAccountBalance = recalculateFinancialAccountBalance;
exports.recalculateCustomerBalances = recalculateCustomerBalances;

// On startup: fix any supplier balances that had been skewed by the subtraction bug
try {
    const allSupps = db.prepare('SELECT id FROM suppliers').all();
    for (const s of allSupps) {
        updateSupplierBalance(s.id);
    }
} catch (e) {
    console.error('Error auto-syncing supplier balances:', e.message);
}
