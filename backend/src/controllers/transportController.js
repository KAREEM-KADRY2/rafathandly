const db = require('../db');

exports.createTransportTrip = (req, res) => {
    const { 
        supplier_id, purchase_id, vehicle, plate_number, driver_name, driver_phone, 
        quantity, from_location, to_location, trip_date, calc_method, paid_by,
        customer_id, transaction_type, notes, vehicle_id
    } = req.body;
    
    let { 
        nawlon_cost,
        advance_amount,
        revenues,
        commission,
        expenses,
        fuel,
        maintenance,
        gratuity_food,
        kilowatts,
        expense_statement
    } = req.body;

    try {
        const rate = parseFloat(nawlon_cost) || 0;
        let totalNawlon = rate;
        
        if (calc_method === 'per_ton') {
            totalNawlon = rate * (parseFloat(quantity) || 1);
        }

        const adv = parseFloat(advance_amount) || 0;
        const rev = parseFloat(revenues) || 0;
        const comm = parseFloat(commission) || 0;
        const exp = parseFloat(expenses) || 0;
        const f = parseFloat(fuel) || 0;
        const maint = parseFloat(maintenance) || 0;
        const grat = parseFloat(gratuity_food) || 0;

        const allowance_balance = (totalNawlon + adv) - (rev + comm + exp + f + maint + grat);

        const transaction = db.transaction(() => {
            const insertTrip = db.prepare(`
                INSERT INTO transport_trips (
                    supplier_id, purchase_id, vehicle, plate_number, driver_name, driver_phone, 
                    quantity, from_location, to_location, trip_date, calc_method, nawlon_cost, 
                    advance_amount, revenues, commission, expenses, fuel, maintenance, gratuity_food, kilowatts, expense_statement, allowance_balance,
                    paid_by, payment_status, collected_amount, customer_id, transaction_type, notes, vehicle_id
                ) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'مستحق', 0, ?, ?, ?, ?)
            `);

            const result = insertTrip.run(
                supplier_id || null,
                purchase_id || null, 
                vehicle || '', 
                plate_number || '', 
                driver_name || '', 
                driver_phone || '', 
                quantity || 0, 
                from_location || '', 
                to_location || '', 
                trip_date, 
                calc_method || 'fixed', 
                totalNawlon,
                adv,
                rev,
                comm,
                exp,
                f,
                maint,
                grat,
                parseFloat(kilowatts) || 0,
                expense_statement || '',
                allowance_balance,
                paid_by || 'الشركة',
                customer_id || null,
                transaction_type || 'نقل',
                notes || '',
                vehicle_id || null
            );

            if (supplier_id && (paid_by === 'المورد' || paid_by === 'المصنع')) {
                db.prepare('UPDATE suppliers SET total_nawlon = total_nawlon + ? WHERE id = ?').run(totalNawlon, supplier_id);
            }
            
            return result.lastInsertRowid;
        });

        const newId = transaction();
        res.status(201).json({ id: newId, message: 'تم تسجيل رحلة النقل بنجاح', totalNawlon, allowance_balance });
    } catch (error) {
        console.error('Error in createTransportTrip:', error);
        res.status(400).json({ error: error.message });
    }
};

exports.getAllTrips = (req, res) => {
    try {
        const { from, to } = req.query;
        let filter = '';
        let params = [];
        
        if (from) {
            filter += ' AND date(t.trip_date) >= date(?)';
            params.push(from);
        }
        if (to) {
            filter += ' AND date(t.trip_date) <= date(?)';
            params.push(to);
        }

        const trips = db.prepare(`
            SELECT t.*, p.invoice_number, s.name as supplier_name, c.name as customer_name 
            FROM transport_trips t
            LEFT JOIN purchases p ON t.purchase_id = p.id
            LEFT JOIN suppliers s ON t.supplier_id = s.id
            LEFT JOIN customers c ON t.customer_id = c.id
            WHERE 1=1 ${filter}
            ORDER BY t.trip_date DESC, t.created_at DESC
        `).all(...params);
        res.json(trips);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTripsByPurchase = (req, res) => {
    try {
        const trips = db.prepare('SELECT * FROM transport_trips WHERE purchase_id = ? ORDER BY created_at DESC').all(req.params.purchaseId);
        res.json(trips);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTripsBySupplier = (req, res) => {
    try {
        const trips = db.prepare(`
            SELECT t.*, p.invoice_number 
            FROM transport_trips t
            LEFT JOIN purchases p ON t.purchase_id = p.id
            WHERE t.supplier_id = ?
            ORDER BY t.created_at DESC
        `).all(req.params.supplierId);
        res.json(trips);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.collectNawlon = (req, res) => {
    const { amount, payment_method, collection_date, reference_number, notes } = req.body;
    const tripId = req.params.id;

    if (!amount || amount <= 0) return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من صفر' });

    try {
        const transaction = db.transaction(() => {
            const trip = db.prepare('SELECT * FROM transport_trips WHERE id = ?').get(tripId);
            if (!trip) throw new Error('النقلة غير موجودة');

            if (trip.paid_by !== 'المورد' && trip.paid_by !== 'المصنع') {
                throw new Error('هذا النولون غير مستحق على المورد');
            }

            const newCollected = trip.collected_amount + parseFloat(amount);
            if (newCollected > trip.nawlon_cost) {
                throw new Error('المبلغ المحصل أكبر من النولون المستحق');
            }

            let status = 'مستحق';
            if (newCollected === trip.nawlon_cost) {
                status = 'تم التحصيل بالكامل';
            } else if (newCollected > 0) {
                status = 'تم التحصيل جزئيا';
            }

            db.prepare('UPDATE transport_trips SET collected_amount = ?, payment_status = ? WHERE id = ?')
                .run(newCollected, status, tripId);

            db.prepare('UPDATE suppliers SET collected_nawlon = collected_nawlon + ? WHERE id = ?')
                .run(parseFloat(amount), trip.supplier_id);

            db.prepare(`
                INSERT INTO freight_transactions (trip_id, supplier_id, amount, payment_method, collection_date, reference_number, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(tripId, trip.supplier_id, amount, payment_method, collection_date, reference_number, notes);

            return { newCollected, status };
        });

        const result = transaction();
        res.json({ message: 'تم تحصيل النولون بنجاح', data: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getFreightTransactions = (req, res) => {
    try {
        const transactions = db.prepare('SELECT * FROM freight_transactions WHERE supplier_id = ? ORDER BY collection_date DESC, created_at DESC').all(req.params.supplierId);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTransportTrip = (req, res) => {
    const { id } = req.params;
    const { 
        supplier_id, purchase_id, vehicle, plate_number, driver_name, driver_phone, 
        quantity, from_location, to_location, trip_date, calc_method, paid_by,
        customer_id, transaction_type, notes, vehicle_id, kilowatts, expense_statement
    } = req.body;
    
    let { 
        nawlon_cost,
        advance_amount,
        revenues,
        commission,
        expenses,
        fuel,
        maintenance,
        gratuity_food
    } = req.body;

    try {
        const rate = parseFloat(nawlon_cost) || 0;
        let totalNawlon = rate;
        
        if (calc_method === 'per_ton') {
            totalNawlon = rate * (parseFloat(quantity) || 1);
        }

        const adv = parseFloat(advance_amount) || 0;
        const rev = parseFloat(revenues) || 0;
        const comm = parseFloat(commission) || 0;
        const exp = parseFloat(expenses) || 0;
        const f = parseFloat(fuel) || 0;
        const maint = parseFloat(maintenance) || 0;
        const grat = parseFloat(gratuity_food) || 0;

        const allowance_balance = (totalNawlon + adv) - (rev + comm + exp + f + maint + grat);

        db.prepare(`
            UPDATE transport_trips SET
                supplier_id = ?, purchase_id = ?, vehicle = ?, plate_number = ?, driver_name = ?, driver_phone = ?,
                quantity = ?, from_location = ?, to_location = ?, trip_date = ?, calc_method = ?,
                nawlon_cost = ?, advance_amount = ?, revenues = ?, commission = ?, expenses = ?,
                fuel = ?, maintenance = ?, gratuity_food = ?, kilowatts = ?, expense_statement = ?, allowance_balance = ?,
                paid_by = ?, customer_id = ?, transaction_type = ?, notes = ?, vehicle_id = ?
            WHERE id = ?
        `).run(
            supplier_id || null, purchase_id || null, vehicle || '', plate_number || '', driver_name || '', driver_phone || '',
            quantity || 0, from_location || '', to_location || '', trip_date, calc_method || 'fixed',
            totalNawlon, adv, rev, comm, exp, f, maint, grat, parseFloat(kilowatts) || 0, expense_statement || '', allowance_balance,
            paid_by || 'الشركة', customer_id || null, transaction_type || 'نقل', notes || '', vehicle_id || null, id
        );

        res.json({ message: 'تم التحديث بنجاح', allowance_balance });
    } catch (error) {
        console.error('Error in updateTransportTrip:', error);
        res.status(400).json({ error: error.message });
    }
};

exports.deleteTransportTrip = (req, res) => {
    const { id } = req.params;
    try {
        const transaction = db.transaction(() => {
            const trip = db.prepare('SELECT * FROM transport_trips WHERE id = ?').get(id);
            if (!trip) return false;

            // Revert supplier balance if nawlon was added
            if (trip.supplier_id && (trip.paid_by === 'المورد' || trip.paid_by === 'المصنع')) {
                db.prepare('UPDATE suppliers SET total_nawlon = MAX(0, total_nawlon - ?) WHERE id = ?')
                    .run(trip.nawlon_cost || 0, trip.supplier_id);
            }

            // Revert collected nawlon from supplier if any
            if (trip.supplier_id && trip.collected_amount > 0) {
                db.prepare('UPDATE suppliers SET collected_nawlon = MAX(0, collected_nawlon - ?) WHERE id = ?')
                    .run(trip.collected_amount, trip.supplier_id);
            }

            // Delete freight transactions
            db.prepare('DELETE FROM freight_transactions WHERE trip_id = ?').run(id);

            // Delete the trip
            const result = db.prepare('DELETE FROM transport_trips WHERE id = ?').run(id);
            return result.changes > 0;
        });

        const deleted = transaction();
        if (!deleted) {
            return res.status(404).json({ error: 'النقلة غير موجودة' });
        }

        res.json({ message: 'تم حذف النقلة بنجاح' });
    } catch (error) {
        console.error('Error in deleteTransportTrip:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getTripsByVehicle = (req, res) => {
    try {
        const vehicle_id = req.params.id;
        const { from, to } = req.query;
        let query = 'SELECT t.*, s.name as supplier_name, c.name as customer_name FROM transport_trips t LEFT JOIN suppliers s ON t.supplier_id = s.id LEFT JOIN customers c ON t.customer_id = c.id WHERE (t.vehicle_id = ? OR t.vehicle = (SELECT name FROM vehicles WHERE id = ?))';
        let params = [vehicle_id, vehicle_id];
        
        if (from && to) {
            query += ' AND date(t.trip_date) BETWEEN date(?) AND date(?)';
            params.push(from, to);
        }
        query += ' ORDER BY t.trip_date DESC, t.created_at DESC';
        
        const trips = db.prepare(query).all(...params);
        res.json(trips);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVehicleReports = (req, res) => {
    try {
        const vehicle_id = req.params.id;
        const { from, to } = req.query;
        let query = `SELECT 
            COUNT(*) as total_trips,
            SUM(nawlon_cost) as total_nawlon,
            SUM(advance_amount) as total_advance,
            SUM(revenues) as total_revenues,
            SUM(commission) as total_commission,
            SUM(expenses) as total_expenses,
            SUM(fuel) as total_fuel,
            SUM(maintenance) as total_maintenance,
            SUM(gratuity_food) as total_gratuity,
            SUM(allowance_balance) as net_amount
        FROM transport_trips WHERE (vehicle_id = ? OR vehicle = (SELECT name FROM vehicles WHERE id = ?))`;
        
        let params = [vehicle_id, vehicle_id];
        if (from && to) {
            query += ' AND date(trip_date) BETWEEN date(?) AND date(?)';
            params.push(from, to);
        }
        
        const summary = db.prepare(query).get(...params);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
