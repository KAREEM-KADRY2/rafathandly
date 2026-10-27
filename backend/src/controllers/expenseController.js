const db = require('../db');
const auditLogger = require('./auditLogger');
const treasuryController = require('./treasuryController');

exports.getAllExpenses = (req, res) => {
    try {
        const { startDate, endDate, expense_type, vehicle } = req.query;
        let query = `SELECT * FROM expenses WHERE status = 'active'`;
        const params = [];

        if (startDate) {
            query += ` AND expense_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND expense_date <= ?`;
            params.push(endDate);
        }
        if (expense_type && expense_type !== 'الكل') {
            query += ` AND expense_type = ?`;
            params.push(expense_type);
        }
        if (vehicle && vehicle !== 'الكل') {
            query += ` AND vehicle = ?`;
            params.push(vehicle);
        }

        query += ` ORDER BY expense_date DESC, id DESC`;

        const expenses = db.prepare(query).all(...params);
        res.json(expenses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب المصروفات' });
    }
};

exports.getExpensesSummary = (req, res) => {
    try {
        const { startDate, endDate, expense_type, vehicle } = req.query;
        let query = `
            SELECT 
                COUNT(id) as count,
                SUM(amount) as total,
                SUM(CASE WHEN expense_type = 'بنزين' THEN amount ELSE 0 END) as total_gasoline,
                SUM(CASE WHEN expense_type = 'جاز' THEN amount ELSE 0 END) as total_diesel,
                SUM(CASE WHEN expense_type = 'صيانة' THEN amount ELSE 0 END) as total_maintenance
            FROM expenses 
            WHERE status = 'active'
        `;
        const params = [];

        if (startDate) {
            query += ` AND expense_date >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND expense_date <= ?`;
            params.push(endDate);
        }
        if (expense_type && expense_type !== 'الكل') {
            query += ` AND expense_type = ?`;
            params.push(expense_type);
        }
        if (vehicle && vehicle !== 'الكل') {
            query += ` AND vehicle = ?`;
            params.push(vehicle);
        }

        const summary = db.prepare(query).get(...params);
        
        let vehicleQuery = `
            SELECT 
                vehicle,
                SUM(CASE WHEN expense_type = 'بنزين' THEN amount ELSE 0 END) as total_gasoline,
                SUM(CASE WHEN expense_type = 'جاز' THEN amount ELSE 0 END) as total_diesel,
                SUM(CASE WHEN expense_type = 'صيانة' THEN amount ELSE 0 END) as total_maintenance,
                SUM(amount) as total
            FROM expenses
            WHERE status = 'active'
        `;
        const vParams = [];
        if (startDate) { vehicleQuery += ` AND expense_date >= ?`; vParams.push(startDate); }
        if (endDate) { vehicleQuery += ` AND expense_date <= ?`; vParams.push(endDate); }
        if (expense_type && expense_type !== 'الكل') { vehicleQuery += ` AND expense_type = ?`; vParams.push(expense_type); }
        vehicleQuery += ` GROUP BY vehicle`;

        const vehicleSummary = db.prepare(vehicleQuery).all(...vParams);

        res.json({
            summary: {
                count: summary.count || 0,
                total: summary.total || 0,
                total_gasoline: summary.total_gasoline || 0,
                total_diesel: summary.total_diesel || 0,
                total_maintenance: summary.total_maintenance || 0
            },
            vehicleSummary
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب ملخص المصروفات' });
    }
};

exports.addExpense = (req, res) => {
    try {
        const { expense_type, vehicle, amount, expense_date, description, document_number, notes, maintenance_type, spare_parts_cost, labor_cost } = req.body;

        if (!expense_type || !vehicle || !amount || !expense_date) {
            return res.status(400).json({ error: 'جميع الحقول الأساسية مطلوبة' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'يجب أن يكون المبلغ أكبر من صفر' });
        }

        const stmt = db.prepare(`
            INSERT INTO expenses (expense_type, vehicle, amount, expense_date, description, document_number, notes, maintenance_type, spare_parts_cost, labor_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            expense_type, 
            vehicle, 
            amount, 
            expense_date, 
            description || '', 
            document_number || '', 
            notes || '', 
            maintenance_type || '', 
            spare_parts_cost || 0, 
            labor_cost || 0
        );

        treasuryController.recordTransaction({
            type: 'payment',
            party_type: 'expense',
            party_name: expense_type,
            amount: amount,
            payment_method: 'نقدي',
            description: description || `مصروفات ${expense_type} - ${vehicle}`,
            reference_type: 'VEHICLE_EXPENSE',
            reference_id: result.lastInsertRowid,
            transaction_date: expense_date
        });

        res.status(201).json({ message: 'تم إضافة المصروف بنجاح', id: result.lastInsertRowid });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المصروف' });
    }
};

exports.updateExpense = (req, res) => {
    try {
        const { id } = req.params;
        const { expense_type, vehicle, amount, expense_date, description, document_number, notes, maintenance_type, spare_parts_cost, labor_cost } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ error: 'يجب أن يكون المبلغ أكبر من صفر' });
        }

        const stmt = db.prepare(`
            UPDATE expenses 
            SET expense_type = ?, vehicle = ?, amount = ?, expense_date = ?, description = ?, document_number = ?, notes = ?, maintenance_type = ?, spare_parts_cost = ?, labor_cost = ?
            WHERE id = ? AND status = 'active'
        `);
        
        const result = stmt.run(
            expense_type, 
            vehicle, 
            amount, 
            expense_date, 
            description || '', 
            document_number || '', 
            notes || '', 
            maintenance_type || '', 
            spare_parts_cost || 0, 
            labor_cost || 0,
            id
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'المصروف غير موجود أو ملغي' });
        }

        res.json({ message: 'تم تعديل المصروف بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء تعديل المصروف' });
    }
};

exports.cancelExpense = (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare(`UPDATE expenses SET status = 'cancelled' WHERE id = ?`);
        const result = stmt.run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'المصروف غير موجود' });
        }

        res.json({ message: 'تم إلغاء المصروف بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء إلغاء المصروف' });
    }
};
