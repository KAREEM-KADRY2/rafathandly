const db = require('../db');

exports.logAction = (user_name, action, module, entity_type, entity_id, description, old_values = null, new_values = null, status = 'SUCCESS') => {
    try {
        const stmt = db.prepare(`
            INSERT INTO audit_logs (user_name, action, module, entity_type, entity_id, description, old_values, new_values, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            user_name || 'مستخدم النظام',
            action,
            module,
            entity_type,
            entity_id ? String(entity_id) : null,
            description || '',
            old_values ? JSON.stringify(old_values) : null,
            new_values ? JSON.stringify(new_values) : null,
            status || 'SUCCESS'
        );
    } catch (e) {
        console.error('Audit Log Error:', e);
    }
};

exports.getLogs = (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const { from, to, search, module, action } = req.query;
        
        let query = `SELECT * FROM audit_logs WHERE 1=1`;
        const params = [];

        if (from) {
            query += ` AND date(created_at) >= date(?)`;
            params.push(from);
        }
        if (to) {
            query += ` AND date(created_at) <= date(?)`;
            params.push(to);
        }
        if (module && module !== 'all') {
            query += ` AND module = ?`;
            params.push(module);
        }
        if (action && action !== 'all') {
            query += ` AND action = ?`;
            params.push(action);
        }
        if (search) {
            query += ` AND (description LIKE ? OR entity_type LIKE ? OR user_name LIKE ? OR action LIKE ?)`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const total = db.prepare(countQuery).get(...params).total;

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const logs = db.prepare(query).all(...params);

        // Summaries
        const today = new Date().toISOString().split('T')[0];
        const summary = db.prepare(`
            SELECT 
                COUNT(*) as total_actions,
                SUM(CASE WHEN date(created_at) = date(?) THEN 1 ELSE 0 END) as today_actions,
                SUM(CASE WHEN module IN ('الخزينة', 'المبيعات', 'المشتريات') THEN 1 ELSE 0 END) as financial_actions
            FROM audit_logs
        `).get(today);

        res.json({
            data: logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            summary: {
                total_actions: summary.total_actions || 0,
                today_actions: summary.today_actions || 0,
                financial_actions: summary.financial_actions || 0,
                user_actions: summary.total_actions || 0 // Assuming all actions are by users for now
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'خطأ في جلب السجلات' });
    }
};
