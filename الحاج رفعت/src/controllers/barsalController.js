const db = require('../db');

exports.getAll = (req, res) => {
    try {
        const records = db.prepare('SELECT * FROM barsal_records ORDER BY record_date DESC, created_at DESC').all();
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getById = (req, res) => {
    try {
        const record = db.prepare('SELECT * FROM barsal_records WHERE id = ?').get(req.params.id);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        res.json(record);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.create = (req, res) => {
    const { record_date, villa, barsal, type, quantity, unit_price, total_amount, paid_amount } = req.body;
    
    try {
        const t_amount = parseFloat(total_amount) || 0;
        const p_amount = parseFloat(paid_amount) || 0;
        const net_amount = t_amount - p_amount;

        const info = db.prepare(`
            INSERT INTO barsal_records (
                record_date, villa, barsal, type, quantity, unit_price, total_amount, paid_amount, net_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            record_date,
            villa || '',
            barsal || '',
            type || '',
            parseFloat(quantity) || 0,
            parseFloat(unit_price) || 0,
            t_amount,
            p_amount,
            net_amount
        );

        res.status(201).json({ id: info.lastInsertRowid, message: 'تم إضافة السجل بنجاح', net_amount });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.update = (req, res) => {
    const { id } = req.params;
    const { record_date, villa, barsal, type, quantity, unit_price, total_amount, paid_amount } = req.body;
    
    try {
        const t_amount = parseFloat(total_amount) || 0;
        const p_amount = parseFloat(paid_amount) || 0;
        const net_amount = t_amount - p_amount;

        const info = db.prepare(`
            UPDATE barsal_records 
            SET record_date = ?, villa = ?, barsal = ?, type = ?, quantity = ?, 
                unit_price = ?, total_amount = ?, paid_amount = ?, net_amount = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            record_date,
            villa || '',
            barsal || '',
            type || '',
            parseFloat(quantity) || 0,
            parseFloat(unit_price) || 0,
            t_amount,
            p_amount,
            net_amount,
            id
        );

        if (info.changes === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'تم التحديث بنجاح', net_amount });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.remove = (req, res) => {
    try {
        const info = db.prepare('DELETE FROM barsal_records WHERE id = ?').run(req.params.id);
        if (info.changes === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'تم الحذف بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getBarsalNames = (req, res) => {
    try {
        const records = db.prepare('SELECT DISTINCT barsal FROM barsal_records WHERE barsal IS NOT NULL AND barsal != "" ORDER BY barsal ASC').all();
        res.json(records.map(r => r.barsal));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getReport = (req, res) => {
    try {
        const { barsal, from, to } = req.query;
        if (!barsal) {
            return res.status(400).json({ error: 'Barsal is required' });
        }

        let query = 'SELECT * FROM barsal_records WHERE barsal = ?';
        const params = [barsal];

        if (from) {
            query += ' AND date(record_date) >= date(?)';
            params.push(from);
        }
        if (to) {
            query += ' AND date(record_date) <= date(?)';
            params.push(to);
        }

        query += ' ORDER BY record_date ASC, created_at ASC';

        const transactions = db.prepare(query).all(params);

        let totalQuantity = 0;
        let totalAmount = 0;
        let totalPaid = 0;
        let totalNet = 0;

        transactions.forEach(t => {
            totalQuantity += Number(t.quantity) || 0;
            totalAmount += Number(t.total_amount) || 0;
            totalPaid += Number(t.paid_amount) || 0;
            totalNet += Number(t.net_amount) || 0;
        });

        res.json({
            barsal: { name: barsal, number: barsal },
            summary: {
                transactionCount: transactions.length,
                totalQuantity,
                totalAmount,
                totalPaid,
                totalNet
            },
            transactions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getParcels = (req, res) => {
    try {
        const records = db.prepare(`
            SELECT MIN(id) as id, villa, barsal, MIN(record_date) as start_date, COUNT(*) as tx_count
            FROM barsal_records 
            WHERE barsal IS NOT NULL AND barsal != ''
            GROUP BY villa, barsal
            ORDER BY start_date DESC
        `).all();
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getReportV2 = (req, res) => {
    try {
        const { parcel_id, from, to } = req.query;
        if (!parcel_id) return res.status(400).json({ error: 'parcel_id is required' });

        const parcelBase = db.prepare('SELECT villa, barsal FROM barsal_records WHERE id = ?').get(parcel_id);
        if (!parcelBase) return res.status(404).json({ error: 'Parcel not found' });

        let query = 'SELECT * FROM barsal_records WHERE villa = ? AND barsal = ?';
        const params = [parcelBase.villa, parcelBase.barsal];

        if (from) {
            query += ' AND date(record_date) >= date(?)';
            params.push(from);
        }
        if (to) {
            query += ' AND date(record_date) <= date(?)';
            params.push(to);
        }

        query += ' ORDER BY record_date ASC, created_at ASC';

        const transactions = db.prepare(query).all(params);

        let totalQuantity = 0;
        let totalAmount = 0;
        let totalPaid = 0;
        let totalNet = 0;

        transactions.forEach(t => {
            totalQuantity += Number(t.quantity) || 0;
            totalAmount += Number(t.total_amount) || 0;
            totalPaid += Number(t.paid_amount) || 0;
            totalNet += Number(t.net_amount) || 0;
        });

        res.json({
            parcel: { 
                id: parcel_id,
                villa: parcelBase.villa,
                barsal: parcelBase.barsal,
                name: `برسل ${parcelBase.barsal} - فيلا ${parcelBase.villa}`
            },
            summary: {
                transactionCount: transactions.length,
                totalQuantity,
                totalAmount,
                totalPaid,
                totalNet
            },
            transactions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
