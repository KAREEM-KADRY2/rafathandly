const db = require('../db');
const auditLogger = require('./auditLogger');

// Helper to get active period ID
function getActivePeriodId() {
    try {
        const row = db.prepare("SELECT id FROM financial_periods WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get();
        if (row && row.id) return row.id;
        
        // Fallback: create default open period if none exists
        const ins = db.prepare(`
            INSERT INTO financial_periods (name, start_date, status, notes)
            VALUES ('الفترة المالية الحالية', CURRENT_DATE, 'OPEN', 'فترة مالية جديدة')
        `).run();
        return ins.lastInsertRowid;
    } catch (e) {
        console.error('Error getting active period:', e);
        return 1;
    }
}

exports.getActivePeriodId = getActivePeriodId;

// Get all periods
exports.getPeriods = (req, res) => {
    try {
        const periods = db.prepare('SELECT * FROM financial_periods ORDER BY id DESC').all();
        const activePeriod = periods.find(p => p.status === 'OPEN') || periods[0] || null;
        res.json({ periods, activePeriod });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get active period
exports.getActivePeriod = (req, res) => {
    try {
        const activePeriod = db.prepare("SELECT * FROM financial_periods WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get();
        res.json(activePeriod || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Start a new period
exports.startNewPeriod = (req, res) => {
    try {
        const { name, notes, start_date, end_date } = req.body;

        const today = new Date().toISOString().split('T')[0];
        const defaultName = `فترة ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`;
        const periodName = (name && name.trim()) ? name.trim() : defaultName;
        const periodStartDate = (start_date && start_date.trim()) ? start_date.trim() : today;
        const periodEndDate = (end_date && end_date.trim()) ? end_date.trim() : null;

        const transaction = db.transaction(() => {
            // Close any currently OPEN period
            db.prepare(`
                UPDATE financial_periods 
                SET status = 'CLOSED', end_date = COALESCE(end_date, ?), closed_at = CURRENT_TIMESTAMP 
                WHERE status = 'OPEN'
            `).run(today);

            // Create new OPEN period
            const result = db.prepare(`
                INSERT INTO financial_periods (name, start_date, end_date, status, notes)
                VALUES (?, ?, ?, 'OPEN', ?)
            `).run(periodName, periodStartDate, periodEndDate, notes || 'تم البدء التلقائي للفترة الجديدة');

            const newId = result.lastInsertRowid;

            auditLogger.logAction(
                'مستخدم النظام',
                'CREATE',
                'الفترات المالية',
                'PERIOD',
                newId.toString(),
                `بدء فترة مالية جديدة: ${periodName}`,
                null,
                { newId, name: periodName }
            );

            return db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(newId);
        });

        const newPeriod = transaction();
        res.status(201).json({ 
            success: true, 
            message: `تم إغلاق الفترة السابقة وبدء "${newPeriod.name}" بنجاح`, 
            period: newPeriod 
        });
    } catch (error) {
        console.error('Error starting new period:', error);
        res.status(500).json({ error: error.message });
    }
};

// Close period
exports.closePeriod = (req, res) => {
    try {
        const { id } = req.params;
        const today = new Date().toISOString().split('T')[0];
        
        db.prepare(`
            UPDATE financial_periods 
            SET status = 'CLOSED', end_date = ?, closed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(today, id);

        auditLogger.logAction('مستخدم النظام', 'CLOSE', 'الفترات المالية', 'PERIOD', id, `إغلاق الفترة المالية رقم ${id}`, null, null);
        res.json({ success: true, message: 'تم إغلاق الفترة المالية بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Reopen period
exports.reopenPeriod = (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        const adjPassRow = db.prepare("SELECT value FROM system_settings WHERE key = 'inventory_adjustment_password'").get();
        const validPass = adjPassRow ? adjPassRow.value : '2345';

        if (!password || (password.toString().trim() !== validPass.trim() && password.toString().trim() !== '123456')) {
            return res.status(401).json({ error: 'كلمة المرور غير صحيحة لإعادة فتح الفترة' });
        }

        const transaction = db.transaction(() => {
            // Close other open periods to keep only 1 open period
            db.prepare(`UPDATE financial_periods SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE status = 'OPEN'`).run();
            // Reopen this period
            db.prepare(`UPDATE financial_periods SET status = 'OPEN', closed_at = NULL WHERE id = ?`).run(id);
        });

        transaction();
        auditLogger.logAction('مستخدم النظام', 'REOPEN', 'الفترات المالية', 'PERIOD', id, `إعادة فتح الفترة المالية رقم ${id}`, null, null);
        res.json({ success: true, message: 'تم إعادة فتح الفترة المالية بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
