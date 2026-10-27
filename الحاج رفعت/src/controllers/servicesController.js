const db = require('../db');
const treasuryController = require('./treasuryController');
const periodsController = require('./periodsController');
const auditLogger = require('./auditLogger');

exports.getAllServices = (req, res) => {
    try {
        const status = req.query.status;
        let query = "SELECT * FROM services";
        let params = [];
        if (status) {
            query += " WHERE status = ?";
            params.push(status);
        }
        query += " ORDER BY name ASC";
        const services = db.prepare(query).all(...params);
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getServiceById = (req, res) => {
    try {
        const service = db.prepare("SELECT * FROM services WHERE id = ?").get(req.params.id);
        if (!service) {
            return res.status(404).json({ error: "Service not found" });
        }
        res.json(service);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createService = (req, res) => {
    try {
        const { name, description, default_price, cost_price, status } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Name is required" });
        }

        const stmt = db.prepare(`
            INSERT INTO services (name, description, default_price, cost_price, status)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            name, 
            description || '', 
            default_price || 0, 
            cost_price || 0, 
            status || 'active'
        );

        auditLogger.logAction('مستخدم النظام', 'إضافة', 'الخدمات', 'SERVICE', result.lastInsertRowid, `تم إضافة خدمة جديدة: ${name}`, null, req.body);
        res.locals.auditLogged = true;

        res.status(201).json({ id: result.lastInsertRowid, message: "Service created successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateService = (req, res) => {
    try {
        const { name, description, default_price, cost_price, status } = req.body;
        
        const oldService = db.prepare("SELECT * FROM services WHERE id = ?").get(req.params.id);
        if (!oldService) {
            return res.status(404).json({ error: "Service not found" });
        }

        const stmt = db.prepare(`
            UPDATE services 
            SET name = ?, description = ?, default_price = ?, cost_price = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        stmt.run(
            name || oldService.name, 
            description !== undefined ? description : oldService.description, 
            default_price !== undefined ? default_price : oldService.default_price, 
            cost_price !== undefined ? cost_price : oldService.cost_price, 
            status || oldService.status,
            req.params.id
        );

        auditLogger.logAction('مستخدم النظام', 'تعديل', 'الخدمات', 'SERVICE', req.params.id, `تم تعديل خدمة: ${name || oldService.name}`, oldService, req.body);
        res.locals.auditLogged = true;

        res.json({ message: "Service updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteService = (req, res) => {
    try {
        const oldService = db.prepare("SELECT * FROM services WHERE id = ?").get(req.params.id);
        if (!oldService) {
            return res.status(404).json({ error: "Service not found" });
        }

        // Soft delete or hard delete? Let's do soft delete by default or hard delete if not used
        // Best to just soft delete
        db.prepare("UPDATE services SET status = 'inactive' WHERE id = ?").run(req.params.id);

        auditLogger.logAction('مستخدم النظام', 'إيقاف', 'الخدمات', 'SERVICE', req.params.id, `تم إيقاف خدمة: ${oldService.name}`, null, null);
        res.locals.auditLogged = true;

        res.json({ message: "Service deactivated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.collectRevenue = (req, res) => {
    try {
        const { service_id, amount, payment_method, party_name, date, description } = req.body;
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من الصفر' });
        }

        let service = null;
        if (service_id) {
            service = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);
        }
        const serviceName = service ? service.name : (description || 'خدمة');
        const targetCustomerName = (party_name && party_name.trim()) ? party_name.trim() : 'عميل عام';
        const saleDate = date || new Date().toISOString().split('T')[0];
        const notes = description || `تحصيل إيراد خدمة: ${serviceName}`;

        const transaction = db.transaction(() => {
            // 1. Find or create customer
            let customer = db.prepare('SELECT id FROM customers WHERE name = ?').get(targetCustomerName);
            if (!customer) {
                const insCust = db.prepare('INSERT INTO customers (name, phone, status) VALUES (?, ?, ?)')
                                  .run(targetCustomerName, '', 'active');
                customer = { id: insCust.lastInsertRowid };
            }

            // 2. Insert into credit_sales (المبيعات)
            const activePeriodId = periodsController.getActivePeriodId();
            const insertSale = db.prepare(`
                INSERT INTO credit_sales 
                (customer_id, invoice_number, original_amount, paid_amount, remaining_amount, sale_date, credit_deadline, due_date, sale_type, status, notes, period_id)
                VALUES (?, ?, ?, ?, 0, ?, 0, ?, 'cash', 'PAID', ?, ?)
            `);
            const saleRes = insertSale.run(
                customer.id,
                null,
                numAmount,
                numAmount,
                saleDate,
                saleDate,
                notes,
                activePeriodId
            );
            const saleId = saleRes.lastInsertRowid;

            db.prepare('UPDATE credit_sales SET invoice_number = ? WHERE id = ?').run(saleId.toString(), saleId);

            // 3. Insert into credit_sale_items
            db.prepare(`
                INSERT INTO credit_sale_items (credit_sale_id, item_type, service_id, item_name, quantity, unit, unit_price, total_price)
                VALUES (?, 'service', ?, ?, 1, 'خدمة', ?, ?)
            `).run(saleId, service_id || null, serviceName, numAmount, numAmount);

            // 4. Record Treasury Transaction (الخزنة)
            treasuryController.recordTransaction({
                payment_method: payment_method || 'نقدية',
                type: 'IN',
                amount: numAmount,
                date: saleDate,
                description: `إيراد خدمة: ${serviceName} (فاتورة مبيعات #${saleId})`,
                party_type: 'customer',
                party_id: customer.id,
                party_name: targetCustomerName,
                related_entity_type: 'service_sale',
                related_entity_id: saleId,
                user: 'مستخدم النظام'
            });

            // 5. Audit Log
            auditLogger.logAction(
                'مستخدم النظام', 'CREATE', 'الخدمات', 'SERVICE_REVENUE', saleId,
                `تم تحصيل إيراد خدمة ${serviceName} بمبلغ ${numAmount} وتسميعه في الخزنة والمبيعات`,
                null,
                { service_id, amount: numAmount, saleId, customerId: customer.id }
            );
        });

        transaction();
        res.status(201).json({ success: true, message: 'تم تحصيل الإيراد وتسميعه في الخزنة والمبيعات بنجاح' });
    } catch (error) {
        console.error('Error collecting service revenue:', error);
        res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحصيل إيراد الخدمة' });
    }
};
