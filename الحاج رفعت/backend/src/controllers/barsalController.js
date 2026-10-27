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

exports.removeParcel = (req, res) => {
    const { villa, barsal } = req.body;
    try {
        if (!barsal) return res.status(400).json({ error: 'اسم البرسل مطلوب' });
        let query = 'DELETE FROM barsal_records WHERE barsal = ?';
        const params = [barsal];
        if (villa && villa !== 'all' && villa !== 'الكل') {
            query += ' AND villa = ?';
            params.push(villa);
        }
        const info = db.prepare(query).run(...params);
        res.json({ message: `تم حذف ${info.changes} حركة بنجاح` });
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
            SELECT MIN(id) as id, villa, barsal, MIN(record_date) as start_date, COUNT(*) as tx_count,
                   COALESCE(SUM(total_amount), 0) as total_amount,
                   COALESCE(SUM(paid_amount), 0) as total_paid,
                   COALESCE(SUM(net_amount), 0) as total_net
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

exports.getTypes = (req, res) => {
    try {
        const records = db.prepare(`
            SELECT DISTINCT type 
            FROM barsal_records 
            WHERE type IS NOT NULL AND type != '' 
            ORDER BY type ASC
        `).all();
        res.json(records.map(r => r.type));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getReportV2 = (req, res) => {
    try {
        const { parcel_id, villa, barsal, type, status, from, to } = req.query;

        let query = 'SELECT * FROM barsal_records WHERE 1=1';
        const params = [];
        let parcelInfo = {
            id: 'all',
            villa: 'الكل',
            barsal: 'الكل',
            name: 'تقرير شامل - جميع الفيلات والبرسل'
        };

        if (parcel_id && parcel_id !== 'all') {
            const parcelBase = db.prepare('SELECT villa, barsal FROM barsal_records WHERE id = ?').get(parcel_id);
            if (parcelBase) {
                query += ' AND villa = ? AND barsal = ?';
                params.push(parcelBase.villa, parcelBase.barsal);
                parcelInfo = {
                    id: parcel_id,
                    villa: parcelBase.villa,
                    barsal: parcelBase.barsal,
                    name: `برسل ${parcelBase.barsal} - فيلا ${parcelBase.villa}`
                };
            }
        }

        if (villa && villa !== 'all') {
            query += ' AND villa = ?';
            params.push(villa);
            if (parcelInfo.id === 'all') {
                parcelInfo.name = `تقرير فيلا ${villa}`;
                parcelInfo.villa = villa;
            }
        }

        if (barsal && barsal !== 'all') {
            query += ' AND barsal = ?';
            params.push(barsal);
            if (parcelInfo.id === 'all') {
                parcelInfo.name += ` - برسل ${barsal}`;
                parcelInfo.barsal = barsal;
            }
        }

        if (type && type !== 'all') {
            query += ' AND type = ?';
            params.push(type);
        }

        if (status === 'unpaid') {
            query += ' AND (net_amount > 0 AND paid_amount = 0)';
        } else if (status === 'partial') {
            query += ' AND (paid_amount > 0 AND net_amount > 0)';
        } else if (status === 'paid') {
            query += ' AND (net_amount <= 0 OR paid_amount >= total_amount)';
        } else if (status === 'outstanding') {
            query += ' AND (net_amount > 0)';
        }

        if (from) {
            query += ' AND date(record_date) >= date(?)';
            params.push(from);
        }
        if (to) {
            query += ' AND date(record_date) <= date(?)';
            params.push(to);
        }

        query += ' ORDER BY record_date ASC, created_at ASC';

        const rawTransactions = db.prepare(query).all(params);

        let totalQuantity = 0;
        let totalAmount = 0;
        let totalPaid = 0;
        let totalNet = 0;
        let paidCount = 0;
        let partialCount = 0;
        let unpaidCount = 0;
        let cumulativeNet = 0;

        const uniqueVillas = new Set();
        const uniqueBarsals = new Set();

        const transactions = rawTransactions.map((t, idx) => {
            const qty = Number(t.quantity) || 0;
            const amt = Number(t.total_amount) || 0;
            const paid = Number(t.paid_amount) || 0;
            const net = Number(t.net_amount) || 0;

            totalQuantity += qty;
            totalAmount += amt;
            totalPaid += paid;
            totalNet += net;
            cumulativeNet += net;

            if (t.villa) uniqueVillas.add(t.villa);
            if (t.barsal) uniqueBarsals.add(t.barsal);

            let paymentStatus = 'unpaid';
            if (net <= 0 || (paid >= amt && amt > 0)) {
                paymentStatus = 'paid';
                paidCount++;
            } else if (paid > 0 && net > 0) {
                paymentStatus = 'partial';
                partialCount++;
            } else {
                paymentStatus = 'unpaid';
                unpaidCount++;
            }

            return {
                ...t,
                row_number: idx + 1,
                running_net: cumulativeNet,
                payment_status: paymentStatus
            };
        });

        // Also get grouped summary by villa and barsal
        let groupQuery = `
            SELECT villa, barsal,
                   COUNT(*) as tx_count,
                   COALESCE(SUM(quantity), 0) as total_quantity,
                   COALESCE(SUM(total_amount), 0) as total_amount,
                   COALESCE(SUM(paid_amount), 0) as total_paid,
                   COALESCE(SUM(net_amount), 0) as total_net,
                   MIN(record_date) as start_date,
                   MAX(record_date) as end_date
            FROM barsal_records
            WHERE 1=1
        `;
        const groupParams = [];
        if (from) {
            groupQuery += ' AND date(record_date) >= date(?)';
            groupParams.push(from);
        }
        if (to) {
            groupQuery += ' AND date(record_date) <= date(?)';
            groupParams.push(to);
        }
        groupQuery += ' GROUP BY villa, barsal ORDER BY total_net DESC, villa ASC';
        const groupedByParcel = db.prepare(groupQuery).all(groupParams);

        const collectionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 100;

        res.json({
            parcel: parcelInfo,
            summary: {
                transactionCount: transactions.length,
                totalQuantity,
                totalAmount,
                totalPaid,
                totalNet,
                paidCount,
                partialCount,
                unpaidCount,
                collectionRate,
                villasCount: uniqueVillas.size,
                parcelsCount: uniqueBarsals.size
            },
            groupedByParcel,
            transactions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
