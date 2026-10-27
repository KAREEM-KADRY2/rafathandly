const db = require('../db');
const auditLogger = require('./auditLogger');
const treasuryController = require('./treasuryController');

exports.getAllOtherExpenses = (req, res) => {
    try {
        const { startDate, endDate, expense_name } = req.query;
        let query = `SELECT oe.*, COALESCE(fa.name, 'النقدي') as account_name FROM other_expenses oe LEFT JOIN financial_accounts fa ON oe.account_id = fa.id WHERE oe.status = 'active'`;
        const params = [];

        if (startDate) {
            query += ` AND expense_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND expense_date <= ?`;
            params.push(endDate);
        }
        if (expense_name && expense_name !== 'الكل') {
            query += ` AND expense_name = ?`;
            params.push(expense_name);
        }

        query += ` ORDER BY expense_date DESC, id DESC`;

        const expenses = db.prepare(query).all(...params);
        res.json(expenses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب المصروفات الأخرى' });
    }
};

exports.getOtherExpensesSummary = (req, res) => {
    try {
        const { startDate, endDate, expense_name } = req.query;

        // Overall Summary
        let overallQuery = `SELECT COUNT(id) as count, COALESCE(SUM(amount), 0) as total FROM other_expenses WHERE status = 'active'`;
        const params = [];

        if (startDate) {
            overallQuery += ` AND expense_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            overallQuery += ` AND expense_date <= ?`;
            params.push(endDate);
        }
        if (expense_name && expense_name !== 'الكل') {
            overallQuery += ` AND expense_name = ?`;
            params.push(expense_name);
        }

        const overall = db.prepare(overallQuery).get(...params);

        // Grouped Summary
        let groupQuery = `SELECT expense_name, COALESCE(SUM(amount), 0) as total FROM other_expenses WHERE status = 'active'`;
        const groupParams = [];
        
        if (startDate) {
            groupQuery += ` AND expense_date >= ?`;
            groupParams.push(startDate);
        }
        if (endDate) {
            groupQuery += ` AND expense_date <= ?`;
            groupParams.push(endDate);
        }
        groupQuery += ` GROUP BY expense_name ORDER BY total DESC`;

        const grouped = db.prepare(groupQuery).all(...groupParams);

        res.json({ overall, grouped });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب ملخص المصروفات' });
    }
};

exports.getUniqueExpenseNames = (req, res) => {
    try {
        const names = db.prepare(`SELECT DISTINCT expense_name FROM other_expenses WHERE status = 'active' ORDER BY expense_name ASC`).all();
        res.json(names.map(n => n.expense_name));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب أسماء المصروفات' });
    }
};

exports.addOtherExpense = (req, res) => {
    try {
        const { expense_name, amount, expense_date, description, document_number, notes, account_id } = req.body;

        if (!expense_name || !amount || !expense_date) {
            return res.status(400).json({ error: 'الاسم والمبلغ والتاريخ حقول مطلوبة' });
        }
        if (amount <= 0) {
            return res.status(400).json({ error: 'يجب أن يكون المبلغ أكبر من صفر' });
        }

        const stmt = db.prepare(`
            INSERT INTO other_expenses (expense_name, amount, expense_date, description, document_number, notes, account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const selectedAccId = account_id ? parseInt(account_id) : 1;
        const result = stmt.run(expense_name.trim(), amount, expense_date, description || '', document_number || '', notes || '', selectedAccId);

        treasuryController.recordTransaction({
            account_id: selectedAccId,
            type: 'payment',
            party_type: 'expense',
            party_name: expense_name.trim(),
            amount: amount,
            payment_method: 'نقدي',
            description: description || `مصروفات أخرى - ${expense_name.trim()}`,
            reference_type: 'OTHER_EXPENSE',
            reference_id: result.lastInsertRowid,
            transaction_date: expense_date
        });

        res.status(201).json({ message: 'تم الإضافة بنجاح', id: result.lastInsertRowid });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المصروف' });
    }
};

exports.updateOtherExpense = (req, res) => {
    try {
        const { id } = req.params;
        const { expense_name, amount, expense_date, description, document_number, notes, account_id } = req.body;

        if (!expense_name || !amount || !expense_date) {
            return res.status(400).json({ error: 'الاسم والمبلغ والتاريخ حقول مطلوبة' });
        }
        if (amount <= 0) {
            return res.status(400).json({ error: 'يجب أن يكون المبلغ أكبر من صفر' });
        }

        const stmt = db.prepare(`
            UPDATE other_expenses 
            SET expense_name = ?, amount = ?, expense_date = ?, description = ?, document_number = ?, notes = ?, account_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'active'
        `);
        const selectedAccId = account_id ? parseInt(account_id) : 1;
        const result = stmt.run(expense_name.trim(), amount, expense_date, description || '', document_number || '', notes || '', selectedAccId, id);

        if (result.changes === 0) return res.status(404).json({ error: 'المصروف غير موجود أو ملغي' });

        res.json({ message: 'تم التعديل بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء التعديل' });
    }
};

exports.cancelOtherExpense = (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare(`UPDATE other_expenses SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
        const result = stmt.run(id);

        if (result.changes === 0) return res.status(404).json({ error: 'المصروف غير موجود' });

        res.json({ message: 'تم الإلغاء بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء الإلغاء' });
    }
};
