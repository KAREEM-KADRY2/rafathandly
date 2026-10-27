
const db = require('../db');
const periodsController = require('./periodsController');

function recalculateCustomerBalances(customerId) {
    if (!customerId) return 0;
    const txs = db.prepare('SELECT * FROM customer_account_transactions WHERE customer_id = ? ORDER BY datetime(transaction_date) ASC, id ASC').all(customerId);
    let running = 0;
    const updateStmt = db.prepare('UPDATE customer_account_transactions SET balance_after = ? WHERE id = ?');
    for (const tx of txs) {
        running += tx.amount;
        updateStmt.run(running, tx.id);
    }
    return running;
}

function reallocateCustomerSales(customerId) {
    if (!customerId) return;
    const sales = db.prepare(`SELECT id, original_amount, COALESCE(zara_amount, 0) as zara_amount FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED' ORDER BY date(sale_date) ASC, id ASC`).all(customerId);
    const updateSaleStmt = db.prepare(`UPDATE credit_sales SET remaining_amount = ?, paid_amount = ?, status = ? WHERE id = ?`);
    for (const sale of sales) {
        const netOriginal = Math.max(0, sale.original_amount - sale.zara_amount);
        updateSaleStmt.run(netOriginal, 0, netOriginal === 0 ? 'PAID' : 'CONFIRMED', sale.id);
    }

    const payments = db.prepare(`SELECT id, amount FROM customer_payments WHERE customer_id = ? AND amount > 0 ORDER BY datetime(payment_date) ASC, id ASC`).all(customerId);

    for (const p of payments) {
        let unallocated = p.amount;
        const openSales = db.prepare(`SELECT id, remaining_amount, paid_amount FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED' AND remaining_amount > 0 ORDER BY date(sale_date) ASC, id ASC`).all(customerId);
        for (const sale of openSales) {
            if (unallocated <= 0) break;
            const toPay = Math.min(unallocated, sale.remaining_amount);
            const newRemaining = sale.remaining_amount - toPay;
            const newPaid = sale.paid_amount + toPay;
            const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
            updateSaleStmt.run(newRemaining, newPaid, newStatus, sale.id);
            unallocated -= toPay;
        }
    }
    
    recalculateCustomerBalances(customerId);
}

function reallocateSupplierPurchases(supplierId) {
    if (!supplierId) return;
    const purchases = db.prepare(`SELECT id, total_amount FROM purchases WHERE supplier_id = ? AND status != 'CANCELLED' ORDER BY date(purchase_date) ASC, id ASC`).all(supplierId);
    const updatePurchStmt = db.prepare(`UPDATE purchases SET remaining_amount = ?, paid_amount = ?, status = ? WHERE id = ?`);
    for (const p of purchases) {
        updatePurchStmt.run(p.total_amount, 0, p.total_amount === 0 ? 'PAID' : 'CONFIRMED', p.id);
    }

    const deposits = db.prepare(`SELECT id, ABS(amount) as amt FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit' AND amount < 0 ORDER BY datetime(created_at) ASC, id ASC`).all(supplierId);

    for (const d of deposits) {
        let unallocated = d.amt;
        const openPurchases = db.prepare(`SELECT id, remaining_amount, paid_amount FROM purchases WHERE supplier_id = ? AND status != 'CANCELLED' AND remaining_amount > 0 ORDER BY date(purchase_date) ASC, id ASC`).all(supplierId);
        for (const p of openPurchases) {
            if (unallocated <= 0) break;
            const toPay = Math.min(unallocated, p.remaining_amount);
            const newRemaining = p.remaining_amount - toPay;
            const newPaid = p.paid_amount + toPay;
            const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
            updatePurchStmt.run(newRemaining, newPaid, newStatus, p.id);
            unallocated -= toPay;
        }
    }
}

function reverseVoucherEffects(tx) {
    if (!tx) return;
    
    // 1. Revert financial account balance
    if (tx.type === 'IN') {
        db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(tx.amount, tx.account_id);
    } else if (tx.type === 'OUT') {
        db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(tx.amount, tx.account_id);
    }

    // 1.5 Revert Transfer counterpart if applicable
    if ((tx.related_entity_type === 'transfer_out' || tx.related_entity_type === 'transfer_in') && tx.related_entity_id) {
        const otherType = tx.related_entity_type === 'transfer_out' ? 'transfer_in' : 'transfer_out';
        const otherTx = db.prepare(`
            SELECT * FROM treasury_transactions 
            WHERE account_id = ? AND related_entity_type = ? AND related_entity_id = ? AND amount = ? 
            ORDER BY ABS(strftime('%s', date) - strftime('%s', ?)) ASC LIMIT 1
        `).get(tx.related_entity_id, otherType, tx.account_id, tx.amount, tx.date);

        if (otherTx) {
            if (otherTx.type === 'IN') {
                db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(otherTx.amount, otherTx.account_id);
            } else if (otherTx.type === 'OUT') {
                db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(otherTx.amount, otherTx.account_id);
            }
            db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(otherTx.id);
        }
    }

    // 2. Revert Customer Voucher
    if (tx.related_entity_type === 'customer' && tx.related_entity_id) {
        if (tx.reference_id) {
            db.prepare('DELETE FROM customer_account_transactions WHERE payment_id = ?').run(tx.reference_id);
            db.prepare('DELETE FROM customer_payments WHERE id = ?').run(tx.reference_id);
        } else {
            const p = db.prepare('SELECT id FROM customer_payments WHERE customer_id = ? AND ABS(amount) = ? ORDER BY id DESC LIMIT 1').get(tx.related_entity_id, tx.amount);
            if (p) {
                db.prepare('DELETE FROM customer_account_transactions WHERE payment_id = ?').run(p.id);
                db.prepare('DELETE FROM customer_payments WHERE id = ?').run(p.id);
            }
        }
        reallocateCustomerSales(tx.related_entity_id);
    }

    // 3. Revert Supplier / Factory Voucher
    else if ((tx.related_entity_type === 'supplier' || tx.related_entity_type === 'factory') && tx.related_entity_id) {
        const sup = db.prepare('SELECT id, type FROM suppliers WHERE id = ?').get(tx.related_entity_id);
        if (sup) {
            const isFactory = sup.type === 'مصنع';
            let oldBalChange = 0;
            if (isFactory) {
                oldBalChange = tx.type === 'OUT' ? tx.amount : -tx.amount;
            } else {
                oldBalChange = tx.type === 'OUT' ? -tx.amount : tx.amount;
            }
            db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(oldBalChange, tx.related_entity_id);
            if (tx.reference_id) {
                db.prepare('DELETE FROM supplier_balance_transactions WHERE id = ?').run(tx.reference_id);
            } else {
                const sbt = db.prepare('SELECT id FROM supplier_balance_transactions WHERE supplier_id = ? AND ABS(amount) = ? ORDER BY id DESC LIMIT 1').get(tx.related_entity_id, tx.amount);
                if (sbt) db.prepare('DELETE FROM supplier_balance_transactions WHERE id = ?').run(sbt.id);
            }
            if (!isFactory) reallocateSupplierPurchases(tx.related_entity_id);
        }
    }

    // 4. Revert Worker Voucher
    else if (tx.related_entity_type === 'worker' && tx.related_entity_id) {
        if (tx.reference_id) {
            db.prepare('DELETE FROM worker_withdrawals WHERE id = ?').run(tx.reference_id);
        } else {
            const w = db.prepare('SELECT id FROM worker_withdrawals WHERE worker_id = ? AND ABS(amount) = ? ORDER BY id DESC LIMIT 1').get(tx.related_entity_id, tx.amount);
            if (w) db.prepare('DELETE FROM worker_withdrawals WHERE id = ?').run(w.id);
        }
    }

    // 5. Revert Partner Voucher
    else if (tx.related_entity_type === 'partner' && tx.related_entity_id) {
        if (tx.reference_id && tx.reference_type === 'partner_transaction') {
            db.prepare('DELETE FROM partner_transactions WHERE id = ?').run(tx.reference_id);
        } else {
            const pt = db.prepare('SELECT id FROM partner_transactions WHERE partner_id = ? AND ABS(amount) = ? ORDER BY id DESC LIMIT 1').get(tx.related_entity_id, tx.amount);
            if (pt) db.prepare('DELETE FROM partner_transactions WHERE id = ?').run(pt.id);
        }
    }
}

function getAccountIdByMethod(method) {
    if (!method) method = 'النقدي';
    const accounts = db.prepare('SELECT id, name, type FROM financial_accounts').all();
    
    let cashId = accounts.find(a => a.type === 'CASH')?.id || 1;
    let bankId = accounts.find(a => a.type === 'BANK')?.id || 2;
    let ewalletId = accounts.find(a => a.type === 'EWALLET')?.id || 5;

    const lower = method.toLowerCase();
    if (lower.includes('cib') || lower.includes('بنك') || lower.includes('bank')) return bankId;
    if (lower.includes('فودافون') || lower.includes('اتصالات') || lower.includes('محفظة') || lower.includes('wallet')) return ewalletId;
    
    return cashId;
}

exports.recordTransaction = (data) => {
    // Support old and new signatures
    let { 
        account_id, 
        type, // old: 'receipt'/'payment', new: 'IN'/'OUT'
        amount, 
        date, 
        transaction_date,
        description, 
        related_entity_type, 
        party_type, // old
        party_name, // old
        party_id,   // old
        related_entity_id, 
        reference_id, // old
        reference_type, // old
        user,
        created_by,
        payment_method
    } = data;
    
    // Map old signature to new
    if (!account_id) {
        account_id = getAccountIdByMethod(payment_method);
    }

    if (type === 'receipt') type = 'IN';
    if (type === 'payment') type = 'OUT';

    const txDate = date || transaction_date || new Date().toISOString();
    const finalDesc = description || (party_name ? `لصالح / من: ${party_name}` : '');
    const finalRelType = related_entity_type || party_type || 'other';
    const finalRelId = related_entity_id || party_id || null;
    const finalRefType = reference_type || null;
    const finalRefId = reference_id || null;
    const finalUser = user || created_by || 'System';

    const activePeriodId = periodsController.getActivePeriodId();
    const stmt = db.prepare(`
        INSERT INTO treasury_transactions 
        (account_id, type, amount, date, description, related_entity_type, related_entity_id, user, period_id, reference_type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const res = stmt.run(
        account_id, 
        type, 
        amount, 
        txDate, 
        finalDesc, 
        finalRelType, 
        finalRelId, 
        finalUser,
        activePeriodId,
        finalRefType,
        finalRefId
    );
    
    // Update balance
    if (type === 'IN') {
        db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(amount, account_id);
    } else if (type === 'OUT') {
        db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(amount, account_id);
    }

    return { id: res.lastInsertRowid };
};

exports.getAccounts = (req, res) => {
    try {
        const accounts = db.prepare('SELECT * FROM financial_accounts').all();
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addAccount = (req, res) => {
    try {
        const { name, type } = req.body;
        if (!name || !type) throw new Error('Name and Type are required');
        const stmt = db.prepare('INSERT INTO financial_accounts (name, type, balance) VALUES (?, ?, 0)');
        const result = stmt.run(name, type);
        res.status(201).json({ id: result.lastInsertRowid, name, type, balance: 0 });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateAccount = (req, res) => {
    try {
        const { id } = req.params;
        const { name, type } = req.body;
        if (!name || !type) throw new Error('الاسم والنوع مطلوبان');
        db.prepare('UPDATE financial_accounts SET name = ?, type = ? WHERE id = ?').run(name, type, id);
        res.json({ success: true, message: 'تم تعديل بيانات الحساب بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteAccount = (req, res) => {
    try {
        const { id } = req.params;
        if (id == 1) throw new Error('لا يمكن حذف حساب النقدية الرئيسي');
        
        const txCount = db.prepare('SELECT COUNT(*) as count FROM treasury_transactions WHERE account_id = ?').get(id).count;
        if (txCount > 0) {
            throw new Error('لا يمكن حذف الحساب لوجود حركات مالية مرتبطة به. يرجى تصفية الحركات أو تعديلها أولاً.');
        }

        db.prepare('DELETE FROM financial_accounts WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getTransactions = (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : '';
        const accountId = req.query.accountId || req.query.account_id;
        const type = req.query.type;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        let whereConditions = [];
        const params = [];

        if (accountId && accountId !== 'all') {
            whereConditions.push('t.account_id = ?');
            params.push(accountId);
        }
        if (type && type !== 'all') {
            whereConditions.push('t.type = ?');
            params.push(type);
        }
        if (startDate) {
            whereConditions.push('date(t.date) >= date(?)');
            params.push(startDate);
        }
        if (endDate) {
            whereConditions.push('date(t.date) <= date(?)');
            params.push(endDate);
        }
        if (search) {
            whereConditions.push('(t.description LIKE ? OR t.user LIKE ? OR a.name LIKE ?)');
            const sParam = `%${search}%`;
            params.push(sParam, sParam, sParam);
        }

        const whereClause = whereConditions.length > 0 ? ' WHERE ' + whereConditions.join(' AND ') : '';

        const countQuery = `
            SELECT COUNT(*) as total 
            FROM treasury_transactions t
            JOIN financial_accounts a ON t.account_id = a.id
            ${whereClause}
        `;
        const total = db.prepare(countQuery).get(...params).total;

        const query = `
            SELECT t.*, a.name as account_name,
                   CASE 
                       WHEN t.related_entity_type = 'customer' THEN (SELECT name FROM customers WHERE id = t.related_entity_id)
                       WHEN t.related_entity_type IN ('supplier', 'factory') THEN (SELECT name FROM suppliers WHERE id = t.related_entity_id)
                       WHEN t.related_entity_type = 'worker' THEN (SELECT name FROM workers WHERE id = t.related_entity_id)
                       WHEN t.related_entity_type = 'partner' THEN (SELECT name FROM partners WHERE id = t.related_entity_id)
                       ELSE NULL
                   END as party_name
            FROM treasury_transactions t
            JOIN financial_accounts a ON t.account_id = a.id
            ${whereClause}
            ORDER BY t.date DESC, t.id DESC
            LIMIT ? OFFSET ?
        `;

        const transactions = db.prepare(query).all(...params, limit, offset);

        const summaryQuery = `
            SELECT 
                SUM(CASE WHEN t.type = 'IN' THEN t.amount ELSE 0 END) as total_in,
                SUM(CASE WHEN t.type = 'OUT' THEN t.amount ELSE 0 END) as total_out
            FROM treasury_transactions t
            JOIN financial_accounts a ON t.account_id = a.id
            ${whereClause}
        `;
        const summary = db.prepare(summaryQuery).get(...params);

        const totalPages = Math.ceil(total / limit) || 1;

        res.json({
            items: transactions,
            transactions,
            total,
            page,
            limit,
            totalPages,
            summary: {
                total_receipts: summary?.total_in || 0,
                total_payments: summary?.total_out || 0,
                balance: (summary?.total_in || 0) - (summary?.total_out || 0)
            }
        });
    } catch (error) {
        console.error('Error in getTransactions:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.transfer = (req, res) => {
    try {
        const { from_account_id, to_account_id, amount, date, description, user } = req.body;
        if (!from_account_id || !to_account_id || !amount || Number(amount) <= 0) {
            throw new Error('بيانات التحويل غير مكتملة أو المبلغ غير صحيح');
        }
        if (parseInt(from_account_id) === parseInt(to_account_id)) {
            throw new Error('لا يمكن التحويل لنفس الخزنة');
        }

        const transaction = db.transaction(() => {
            const fromAcc = db.prepare('SELECT name FROM financial_accounts WHERE id = ?').get(from_account_id);
            const toAcc = db.prepare('SELECT name FROM financial_accounts WHERE id = ?').get(to_account_id);

            const txDate = date || new Date().toISOString();
            const fromDesc = description 
                ? `${description} (تحويل صادر إلى: ${toAcc ? toAcc.name : to_account_id})` 
                : `تحويل صادر إلى خزنة: ${toAcc ? toAcc.name : to_account_id}`;
            const toDesc = description 
                ? `${description} (تحويل وارد من: ${fromAcc ? fromAcc.name : from_account_id})` 
                : `تحويل وارد من خزنة: ${fromAcc ? fromAcc.name : from_account_id}`;

            // OUT from from_account
            exports.recordTransaction({
                account_id: parseInt(from_account_id),
                type: 'OUT',
                amount: Number(amount),
                date: txDate,
                description: fromDesc,
                related_entity_type: 'transfer_out',
                related_entity_id: parseInt(to_account_id),
                user: user || 'مستخدم النظام'
            });

            // IN to to_account
            exports.recordTransaction({
                account_id: parseInt(to_account_id),
                type: 'IN',
                amount: Number(amount),
                date: txDate,
                description: toDesc,
                related_entity_type: 'transfer_in',
                related_entity_id: parseInt(from_account_id),
                user: user || 'مستخدم النظام'
            });
        });

        transaction();
        res.json({ success: true, message: 'تم التحويل بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getAccountStatement = (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, type, search } = req.query;

        const account = db.prepare('SELECT * FROM financial_accounts WHERE id = ?').get(id);
        if (!account) return res.status(404).json({ error: 'الحساب المالي أو الخزنة غير موجودة' });

        // Get Opening Balance
        const obRow = db.prepare("SELECT * FROM opening_balances WHERE entity_type IN ('treasury', 'financial_account') AND entity_id = ?").get(id);
        const opening_balance = obRow ? {
            amount: Number(obRow.amount) || 0,
            balance_type: obRow.balance_type || 'credit',
            effective_date: obRow.effective_date,
            notes: obRow.notes
        } : null;

        // Query all transactions for sequential running balance
        const allTxsQuery = `
            SELECT t.*, 
                   a.name as account_name,
                   CASE 
                       WHEN t.related_entity_type = 'customer' THEN (SELECT name FROM customers WHERE id = t.related_entity_id)
                       WHEN t.related_entity_type IN ('supplier', 'factory') THEN (SELECT name FROM suppliers WHERE id = t.related_entity_id)
                       WHEN t.related_entity_type = 'worker' THEN (SELECT name FROM workers WHERE id = t.related_entity_id)
                       WHEN t.related_entity_type = 'partner' THEN (SELECT name FROM partners WHERE id = t.related_entity_id)
                       WHEN t.related_entity_type IN ('transfer_in', 'transfer_out') THEN (SELECT name FROM financial_accounts WHERE id = t.related_entity_id)
                       ELSE NULL
                   END as party_name,
                   CASE
                       WHEN t.related_entity_type = 'customer' THEN 'عميل'
                       WHEN t.related_entity_type = 'supplier' THEN 'مورد'
                       WHEN t.related_entity_type = 'factory' THEN 'مصنع'
                       WHEN t.related_entity_type = 'worker' THEN 'عامل'
                       WHEN t.related_entity_type = 'partner' THEN 'شريك'
                       WHEN t.related_entity_type = 'transfer_out' THEN 'تحويل إلى خزنة أخرى'
                       WHEN t.related_entity_type = 'transfer_in' THEN 'تحويل من خزنة أخرى'
                       WHEN t.related_entity_type = 'OPENING_BALANCE' THEN 'رصيد افتتاحي'
                       ELSE 'أخرى'
                   END as party_type_label
            FROM treasury_transactions t
            JOIN financial_accounts a ON t.account_id = a.id
            WHERE t.account_id = ?
            ORDER BY datetime(t.date) ASC, t.id ASC
        `;
        const rawTransactions = db.prepare(allTxsQuery).all(id);

        let running = 0;
        let total_in = 0;
        let total_out = 0;
        let transfers_in = 0;
        let transfers_out = 0;

        const transactionsWithBalance = rawTransactions.map(tx => {
            const numAmt = Number(tx.amount) || 0;
            if (tx.type === 'IN') {
                running += numAmt;
                total_in += numAmt;
                if (tx.related_entity_type === 'transfer_in') {
                    transfers_in += numAmt;
                }
            } else if (tx.type === 'OUT') {
                running -= numAmt;
                total_out += numAmt;
                if (tx.related_entity_type === 'transfer_out') {
                    transfers_out += numAmt;
                }
            }

            return {
                ...tx,
                running_balance: running
            };
        });

        // Apply filters
        let filtered = [...transactionsWithBalance];

        if (type === 'TRANSFER') {
            filtered = filtered.filter(t => t.related_entity_type === 'transfer_in' || t.related_entity_type === 'transfer_out');
        } else if (type === 'IN') {
            filtered = filtered.filter(t => t.type === 'IN');
        } else if (type === 'OUT') {
            filtered = filtered.filter(t => t.type === 'OUT');
        }

        if (startDate) {
            filtered = filtered.filter(t => t.date && t.date.split('T')[0] >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(t => t.date && t.date.split('T')[0] <= endDate);
        }

        if (search && search.trim()) {
            const s = search.trim().toLowerCase();
            filtered = filtered.filter(t => 
                (t.description && t.description.toLowerCase().includes(s)) ||
                (t.party_name && t.party_name.toLowerCase().includes(s)) ||
                (t.user && t.user.toLowerCase().includes(s)) ||
                String(t.amount).includes(s)
            );
        }

        // Latest transactions first
        filtered.reverse();

        res.json({
            account,
            opening_balance,
            summary: {
                current_balance: Number(account.balance) || 0,
                total_in,
                total_out,
                transfers_in,
                transfers_out,
                net_transfers: transfers_in - transfers_out,
                total_transactions: rawTransactions.length,
                total_transfers_count: rawTransactions.filter(t => t.related_entity_type === 'transfer_in' || t.related_entity_type === 'transfer_out').length
            },
            transactions: filtered
        });
    } catch (error) {
        console.error('Error in getAccountStatement:', error);
        res.status(500).json({ error: error.message });
    }
};


exports.createVoucher = (req, res) => {
    const { type, party_type, party_id, party_name, amount, payment_method, account_id, transaction_date, description } = req.body;
    const numAmount = Number(amount);
    
    if (numAmount <= 0) return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من الصفر' });
    
    const txType = (type === 'receipt' || type === 'IN') ? 'IN' : 'OUT';
    const parsedPartyId = party_id ? parseInt(party_id, 10) : null;
    const txDate = transaction_date || new Date().toISOString();
    
    // Idempotency check: prevent duplicate posting on network retry or rapid double-click within 3 seconds
    const targetAccId = account_id ? parseInt(account_id, 10) : 1;
    const recentDuplicate = db.prepare(`
        SELECT id FROM treasury_transactions 
        WHERE type = ? AND amount = ? 
          AND related_entity_type = ? 
          AND (related_entity_id = ? OR (related_entity_id IS NULL AND ? IS NULL))
          AND account_id = ?
          AND datetime(created_at) >= datetime('now', '-3 seconds')
        ORDER BY id DESC LIMIT 1
    `).get(txType, numAmount, party_type || 'other', parsedPartyId, parsedPartyId, targetAccId);

    if (recentDuplicate) {
        return res.json({ 
            success: true, 
            message: 'تم حفظ السند مسبقاً (تم منع تكرار العملية بنجاح)', 
            duplicatePrevented: true, 
            id: recentDuplicate.id 
        });
    }

    try {
        db.transaction(() => {
            let refType = party_type || 'other';
            let refId = null;

            // 1. Customer Voucher
            if (party_type === 'customer' && parsedPartyId) {
                const paymentAmount = txType === 'IN' ? numAmount : -numAmount;
                const txDesc = description || (txType === 'IN' ? 'سند قبض' : 'سند صرف (رد نقدية للعميل)');
                
                const paymentRes = db.prepare(`
                    INSERT INTO customer_payments (customer_id, amount, payment_method, payment_date, notes) 
                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    parsedPartyId, paymentAmount, payment_method || 'نقدي', txDate, txDesc
                );
                refId = paymentRes.lastInsertRowid;
                refType = 'customer_payment';

                const catAmount = txType === 'IN' ? -numAmount : numAmount;
                db.prepare(`
                    INSERT INTO customer_account_transactions (customer_id, payment_id, transaction_type, amount, balance_after, transaction_date, notes)
                    VALUES (?, ?, 'PAYMENT', ?, 0, ?, ?)
                `).run(parsedPartyId, refId, catAmount, txDate, txDesc);

                reallocateCustomerSales(parsedPartyId);
                
            // 2. Supplier / Factory Voucher
            } else if ((party_type === 'supplier' || party_type === 'factory') && parsedPartyId) {
                let supplier = db.prepare('SELECT id, type, balance FROM suppliers WHERE id = ?').get(parsedPartyId);
                if (supplier) {
                    const isFactory = supplier.type === 'مصنع';
                    let balanceChange = 0;
                    let sbtAmount = 0;
                    const txDesc = description || (txType === 'IN' ? 'سند قبض' : 'سند صرف');
                    
                    if (isFactory) {
                        // Factory: OUT increases prepaid balance (+), IN decreases prepaid balance (-)
                        balanceChange = txType === 'OUT' ? numAmount : -numAmount;
                        sbtAmount = txType === 'OUT' ? numAmount : -numAmount;
                    } else {
                        // Normal Supplier: OUT decreases debt (-), IN increases debt (+)
                        balanceChange = txType === 'OUT' ? -numAmount : numAmount;
                        sbtAmount = txType === 'OUT' ? -numAmount : numAmount;
                    }
                    
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(balanceChange, parsedPartyId);
                    
                    const activePeriodId = periodsController.getActivePeriodId();
                    const sbtRes = db.prepare(`
                        INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, account_id, created_at, period_id)
                        VALUES (?, ?, 'deposit', '', ?, ?, ?, ?)
                    `).run(parsedPartyId, sbtAmount, txDesc, targetAccId, txDate, activePeriodId);
                    refId = sbtRes.lastInsertRowid;
                    refType = 'supplier_transaction';

                    if (!isFactory) reallocateSupplierPurchases(parsedPartyId);
                }

            // 3. Worker Voucher
            } else if (party_type === 'worker' && parsedPartyId) {
                const w_amount = txType === 'OUT' ? numAmount : -numAmount;
                const typeText = txType === 'OUT' ? 'سحب من الخزنة' : 'استرداد نقدي للخزنة';
                
                const workerRes = db.prepare(`
                    INSERT INTO worker_withdrawals (worker_id, amount, withdrawal_type, withdrawal_date, description)
                    VALUES (?, ?, 'سلفة', ?, ?)
                `).run(parsedPartyId, w_amount, txDate, description || typeText);
                refId = workerRes.lastInsertRowid;
                refType = 'worker_withdrawal';

            // 4. Partner Voucher
            } else if (party_type === 'partner' && parsedPartyId) {
                const pTxType = txType === 'IN' ? 'capital_contribution' : 'withdrawal';
                const pDesc = description || (txType === 'IN' ? 'مساهمة رأس مال من الشريك' : 'سحب شخصي للشريك');
                const pRes = db.prepare(`
                    INSERT INTO partner_transactions (partner_id, transaction_type, amount, transaction_date, payment_method, account_id, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(parsedPartyId, pTxType, numAmount, txDate, payment_method || 'نقدي', account_id || 1, pDesc);
                refId = pRes.lastInsertRowid;
                refType = 'partner_transaction';
            }

            // 4. Record In Treasury Transactions
            exports.recordTransaction({
                account_id: account_id ? parseInt(account_id, 10) : undefined,
                type: txType,
                amount: numAmount,
                date: txDate,
                description: description || (txType === 'IN' ? 'سند قبض - ' + (party_name || '') : 'سند صرف - ' + (party_name || '')),
                related_entity_type: party_type,
                related_entity_id: parsedPartyId,
                party_type: party_type,
                party_id: parsedPartyId,
                payment_method: payment_method,
                reference_type: refType,
                reference_id: refId,
                user: 'مستخدم النظام'
            });
        })();
        
        res.json({ success: true, message: 'تم حفظ السند بنجاح' });
    } catch (error) {
        console.error('Voucher error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateVoucher = (req, res) => {
    const { id } = req.params;
    const { type, party_type, party_id, party_name, amount, payment_method, account_id, transaction_date, description } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من الصفر' });

    const txType = (type === 'receipt' || type === 'IN') ? 'IN' : 'OUT';
    const parsedPartyId = party_id ? parseInt(party_id, 10) : null;
    const txDate = transaction_date || new Date().toISOString();

    try {
        const oldTx = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(id);
        if (!oldTx) return res.status(404).json({ error: 'السند غير موجود' });

        const targetAccountId = account_id ? parseInt(account_id, 10) : (oldTx.account_id || 1);

        db.transaction(() => {
            // 1. Revert previous effects
            reverseVoucherEffects(oldTx);

            // 2. Apply new voucher effects
            let newRefType = party_type || 'other';
            let newRefId = null;

            if (party_type === 'customer' && parsedPartyId) {
                const paymentAmount = txType === 'IN' ? numAmount : -numAmount;
                const txDesc = description || (txType === 'IN' ? 'سند قبض' : 'سند صرف (رد نقدية للعميل)');
                const paymentRes = db.prepare(`
                    INSERT INTO customer_payments (customer_id, amount, payment_method, payment_date, notes)
                    VALUES (?, ?, ?, ?, ?)
                `).run(parsedPartyId, paymentAmount, payment_method || 'نقدي', txDate, txDesc);
                newRefId = paymentRes.lastInsertRowid;
                newRefType = 'customer_payment';

                const catAmount = txType === 'IN' ? -numAmount : numAmount;
                db.prepare(`
                    INSERT INTO customer_account_transactions (customer_id, payment_id, transaction_type, amount, balance_after, transaction_date, notes)
                    VALUES (?, ?, 'PAYMENT', ?, 0, ?, ?)
                `).run(parsedPartyId, newRefId, catAmount, txDate, txDesc);

                reallocateCustomerSales(parsedPartyId);
            } else if ((party_type === 'supplier' || party_type === 'factory') && parsedPartyId) {
                const supplier = db.prepare('SELECT id, type FROM suppliers WHERE id = ?').get(parsedPartyId);
                if (supplier) {
                    const isFactory = supplier.type === 'مصنع';
                    let balanceChange = 0;
                    let sbtAmount = 0;
                    const txDesc = description || (txType === 'IN' ? 'سند قبض' : 'سند صرف');
                    if (isFactory) {
                        balanceChange = txType === 'OUT' ? numAmount : -numAmount;
                        sbtAmount = txType === 'OUT' ? numAmount : -numAmount;
                    } else {
                        balanceChange = txType === 'OUT' ? -numAmount : numAmount;
                        sbtAmount = txType === 'OUT' ? -numAmount : numAmount;
                    }

                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(balanceChange, parsedPartyId);
                    const activePeriodId = periodsController.getActivePeriodId();
                    const sbtRes = db.prepare(`
                        INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, account_id, created_at, period_id)
                        VALUES (?, ?, 'deposit', '', ?, ?, ?, ?)
                    `).run(parsedPartyId, sbtAmount, txDesc, targetAccountId, txDate, activePeriodId);
                    newRefId = sbtRes.lastInsertRowid;
                    newRefType = 'supplier_transaction';

                    if (!isFactory) reallocateSupplierPurchases(parsedPartyId);
                }
            } else if (party_type === 'worker' && parsedPartyId) {
                const w_amount = txType === 'OUT' ? numAmount : -numAmount;
                const typeText = txType === 'OUT' ? 'سحب من الخزنة' : 'استرداد نقدي للخزنة';
                const workerRes = db.prepare(`
                    INSERT INTO worker_withdrawals (worker_id, amount, withdrawal_type, withdrawal_date, description)
                    VALUES (?, ?, 'سلفة', ?, ?)
                `).run(parsedPartyId, w_amount, txDate, description || typeText);
                newRefId = workerRes.lastInsertRowid;
                newRefType = 'worker_withdrawal';
            } else if (party_type === 'partner' && parsedPartyId) {
                const pTxType = txType === 'IN' ? 'capital_contribution' : 'withdrawal';
                const pDesc = description || (txType === 'IN' ? 'مساهمة رأس مال من الشريك' : 'سحب شخصي للشريك');
                const pRes = db.prepare(`
                    INSERT INTO partner_transactions (partner_id, transaction_type, amount, transaction_date, payment_method, account_id, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(parsedPartyId, pTxType, numAmount, txDate, payment_method || 'نقدي', targetAccountId, pDesc);
                newRefId = pRes.lastInsertRowid;
                newRefType = 'partner_transaction';
            }

            // Update financial account balance
            if (txType === 'IN') {
                db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(numAmount, targetAccountId);
            } else {
                db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(numAmount, targetAccountId);
            }

            // Update treasury_transactions row
            const finalDesc = description || (txType === 'IN' ? 'سند قبض - ' + (party_name || '') : 'سند صرف - ' + (party_name || ''));
            db.prepare(`
                UPDATE treasury_transactions
                SET account_id = ?, type = ?, amount = ?, date = ?, description = ?,
                    related_entity_type = ?, related_entity_id = ?, reference_type = ?, reference_id = ?
                WHERE id = ?
            `).run(targetAccountId, txType, numAmount, txDate, finalDesc, party_type, parsedPartyId, newRefType, newRefId, id);
        })();

        res.json({ success: true, message: 'تم تعديل السند المالي بنجاح' });
    } catch (error) {
        console.error('Error in updateVoucher:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteVoucher = (req, res) => {
    const { id } = req.params;
    try {
        const tx = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(id);
        if (!tx) return res.status(404).json({ error: 'السند غير موجود' });

        db.transaction(() => {
            reverseVoucherEffects(tx);
            db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(id);
        })();

        res.json({ success: true, message: 'تم حذف السند المالي وعكس كافة تأثيراته بنجاح' });
    } catch (error) {
        console.error('Error in deleteVoucher:', error);
        res.status(500).json({ error: error.message });
    }
};