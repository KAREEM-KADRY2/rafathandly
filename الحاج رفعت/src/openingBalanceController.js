const db = require('../db');
const auditLogger = require('./auditLogger');

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
        const openingPrepaid = obRow ? obRow.amount : 0;

        const depositsRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit' AND amount > 0").get(supplierId);
        const totalDeposits = depositsRow ? depositsRow.total : 0;

        const purchasesRow = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE supplier_id = ?").get(supplierId);
        const totalPurchases = purchasesRow ? purchasesRow.total : 0;

        const currentPrepaid = openingPrepaid + totalDeposits - totalPurchases;
        db.prepare('UPDATE suppliers SET balance = ? WHERE id = ?').run(currentPrepaid, supplierId);
        return currentPrepaid;
    } else {
        // Material Supplier Payable: Opening Balance (credit) + Purchases - Payments (deposit)
        const obRow = db.prepare("SELECT balance_type, amount FROM opening_balances WHERE entity_type = 'supplier' AND entity_id = ?").get(supplierId);
        let openingPayable = 0;
        if (obRow) {
            openingPayable = obRow.balance_type === 'credit' ? obRow.amount : -obRow.amount;
        }

        const purchasesRow = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE supplier_id = ?").get(supplierId);
        const totalPurchases = purchasesRow ? purchasesRow.total : 0;

        const paymentsRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit'").get(supplierId);
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
        let { entity_type, entity_id, balance_type, amount, effective_date, notes, reference } = req.body;

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

            // Audit log
            auditLogger.logAction(
                'مستخدم النظام',
                existingOB ? 'UPDATE' : 'CREATE',
                'الرصيد الافتتاحي',
                entity_type.toUpperCase(),
                String(entity_id),
                `${existingOB ? 'تعديل' : 'إضافة'} رصيد افتتاحي لـ (${entityName}) بقيمة ${numAmount.toLocaleString()} ج.م بتاريخ ${effective_date}`,
                existingOB ? JSON.stringify(existingOB) : null,
                JSON.stringify({ entity_type, entity_id, balance_type, amount: numAmount, effective_date, notes, reference })
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
