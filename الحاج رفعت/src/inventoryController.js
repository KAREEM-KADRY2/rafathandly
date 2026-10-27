const db = require('../db');
const auditLogger = require('./auditLogger');

exports.getItems = (req, res) => {
    try {
        const items = db.prepare(`
            SELECT i.*, 
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = i.id AND movement_type IN ('IN', 'ADJUST_IN')), 0) as total_in,
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = i.id AND movement_type IN ('OUT', 'ADJUST_OUT')), 0) as total_out,
                   COALESCE((SELECT MAX(movement_date) FROM inventory_movements WHERE item_id = i.id), i.created_at) as last_movement
            FROM inventory_items i
        `).all();

        const formattedItems = items.map(item => {
            const current_stock = item.total_in - item.total_out;
            let status = 'متوفر';
            if (current_stock <= 0) status = 'نفد المخزون';
            else if (current_stock <= item.min_stock) status = 'مخزون منخفض';

            return {
                ...item,
                current_stock,
                status
            };
        });

        res.json(formattedItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getItemById = (req, res) => {
    try {
        const item = db.prepare(`
            SELECT i.*, 
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = i.id AND movement_type IN ('IN', 'ADJUST_IN')), 0) as total_in,
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = i.id AND movement_type IN ('OUT', 'ADJUST_OUT')), 0) as total_out
            FROM inventory_items i WHERE id = ?
        `).get(req.params.id);

        if (!item) return res.status(404).json({ error: 'Item not found' });
        
        item.current_stock = item.total_in - item.total_out;
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getItemMovements = (req, res) => {
    try {
        const movements = db.prepare(`
            SELECT m.*, 
                   s.name as supplier_name,
                   c.name as customer_name
            FROM inventory_movements m
            LEFT JOIN suppliers s ON m.supplier_id = s.id
            LEFT JOIN customers c ON m.customer_id = c.id
            WHERE m.item_id = ?
            ORDER BY m.movement_date DESC, m.created_at DESC
        `).all(req.params.id);

        res.json(movements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getItemPurchases = (req, res) => {
    try {
        // Group by supplier
        const purchases = db.prepare(`
            SELECT m.supplier_id, s.name as supplier_name, SUM(m.quantity) as total_quantity, MAX(m.movement_date) as last_purchase_date
            FROM inventory_movements m
            JOIN suppliers s ON m.supplier_id = s.id
            WHERE m.item_id = ? AND m.reference_type = 'PURCHASE'
            GROUP BY m.supplier_id
            ORDER BY total_quantity DESC
        `).all(req.params.id);

        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getItemSales = (req, res) => {
    try {
        // Group by customer
        const sales = db.prepare(`
            SELECT m.customer_id, c.name as customer_name, SUM(m.quantity) as total_quantity, MAX(m.movement_date) as last_sale_date
            FROM inventory_movements m
            JOIN customers c ON m.customer_id = c.id
            WHERE m.item_id = ? AND m.reference_type = 'SALE'
            GROUP BY m.customer_id
            ORDER BY total_quantity DESC
        `).all(req.params.id);

        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSummary = (req, res) => {
    try {
        const items = db.prepare(`
            SELECT id, min_stock,
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = i.id AND movement_type IN ('IN', 'ADJUST_IN')), 0) as total_in,
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = i.id AND movement_type IN ('OUT', 'ADJUST_OUT')), 0) as total_out
            FROM inventory_items i
        `).all();

        let total_items = items.length;
        let total_quantity = 0;
        let low_stock_count = 0;
        let out_of_stock_count = 0;
        let total_in = 0;
        let total_out = 0;

        items.forEach(item => {
            const current = item.total_in - item.total_out;
            total_quantity += current;
            total_in += item.total_in;
            total_out += item.total_out;

            if (current <= 0) out_of_stock_count++;
            else if (current <= item.min_stock) low_stock_count++;
        });

        res.json({
            total_items,
            total_quantity,
            low_stock_count,
            out_of_stock_count,
            total_in,
            total_out
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAdjustmentPassword = () => {
    try {
        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'inventory_adjustment_password'").get();
        if (row && row.value) return row.value;
    } catch (e) {}
    return '2345';
};

exports.verifyAdjustmentPassword = (req, res) => {
    try {
        const { password } = req.body;
        const correctPassword = getAdjustmentPassword();
        if (password !== undefined && password !== null && password.toString().trim() === correctPassword) {
            return res.json({ success: true, message: 'كلمة المرور صحيحة' });
        } else {
            return res.status(401).json({ success: false, error: 'كلمة المرور غير صحيحة' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

exports.createAdjustment = (req, res) => {
    const { password, item_id, current_stock, actual_stock, new_quantity, difference, reason, adjustment_date, notes } = req.body;
    
    try {
        const correctPassword = getAdjustmentPassword();
        if (!password || password.toString().trim() !== correctPassword) {
            return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
        }

        const transaction = db.transaction(() => {
            const item = db.prepare('SELECT unit FROM inventory_items WHERE id = ?').get(item_id);
            if (!item) throw new Error('الصنف غير موجود');

            let curStock = current_stock;
            if (curStock === undefined) {
                const movSum = db.prepare(`
                    SELECT 
                        COALESCE(SUM(CASE WHEN movement_type IN ('PURCHASE', 'ADJUST_IN', 'IN') THEN quantity ELSE 0 END), 0) -
                        COALESCE(SUM(CASE WHEN movement_type IN ('SALE', 'ADJUST_OUT', 'OUT') THEN quantity ELSE 0 END), 0) as total
                    FROM inventory_movements WHERE item_id = ?
                `).get(item_id);
                curStock = movSum ? movSum.total : 0;
            }

            let diff = 0;
            if (difference !== undefined && !isNaN(parseFloat(difference))) {
                diff = parseFloat(difference);
            } else if (new_quantity !== undefined && !isNaN(parseFloat(new_quantity))) {
                diff = parseFloat(new_quantity) - parseFloat(curStock);
            } else if (actual_stock !== undefined && !isNaN(parseFloat(actual_stock))) {
                diff = parseFloat(actual_stock) - parseFloat(curStock);
            }

            if (diff === 0) throw new Error('لا يوجد فرق للتسوية');

            const movement_type = diff > 0 ? 'ADJUST_IN' : 'ADJUST_OUT';
            const quantity = Math.abs(diff);
            const mDate = adjustment_date || new Date().toISOString().slice(0, 19).replace('T', ' ');

            const insertMovement = db.prepare(`
                INSERT INTO inventory_movements 
                (item_id, movement_type, quantity, unit, reference_type, movement_date, notes)
                VALUES (?, ?, ?, ?, 'ADJUSTMENT', ?, ?)
            `);
            const result = insertMovement.run(item_id, movement_type, quantity, item.unit, mDate, notes || reason || 'تسوية مخزنية');
            
            return result.lastInsertRowid;
        });

        const id = Number(transaction());
        res.status(201).json({ id, message: 'تم حفظ التسوية بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateItem = (req, res) => {
    try {
        const { name, unit, secondary_unit, conversion_factor, conversion_operator, min_stock } = req.body;
        const info = db.prepare(`
            UPDATE inventory_items 
            SET name = ?, unit = ?, secondary_unit = ?, conversion_factor = ?, conversion_operator = ?, min_stock = ?
            WHERE id = ?
        `).run(
            name, 
            unit, 
            secondary_unit || null, 
            conversion_factor || null, 
            conversion_operator || '/',
            min_stock || 0,
            req.params.id
        );
        if (info.changes === 0) return res.status(404).json({ error: 'Item not found' });
        res.json({ message: 'Item updated successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


function getDefaultItemUnits(itemName, userUnit) {
    const name = (itemName || '').trim().toLowerCase();
    if (name.includes('أسمنت') || name.includes('اسمنت') || name.includes('سمنت')) {
        return { unit: 'طن', secondary_unit: 'شكارة', conversion_factor: 20, conversion_operator: '/' };
    }
    if (name.includes('رمل') || name.includes('رمال') || name.includes('رملة')) {
        return { unit: 'نقلة', secondary_unit: 'متر ونص', conversion_factor: 1.5, conversion_operator: '/' };
    }
    return { unit: userUnit || 'طن', secondary_unit: null, conversion_factor: null, conversion_operator: '/' };
}

exports.createItem = (req, res) => {
    let { name, unit, min_stock, secondary_unit, conversion_factor, conversion_operator } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'الاسم مطلوب' });
    }

    const defaults = getDefaultItemUnits(name, unit);
    unit = unit || defaults.unit;
    secondary_unit = secondary_unit || defaults.secondary_unit;
    conversion_factor = conversion_factor || defaults.conversion_factor;
    conversion_operator = conversion_operator || defaults.conversion_operator;

    try {
        const db = require('../db');
        const stmt = db.prepare('INSERT INTO inventory_items (name, unit, min_stock, secondary_unit, conversion_factor, conversion_operator) VALUES (?, ?, ?, ?, ?, ?)');
        const result = stmt.run(
            name, 
            unit, 
            min_stock || 0, 
            secondary_unit || null, 
            conversion_factor || null, 
            conversion_operator || '/'
        );
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'هذا الصنف موجود بالفعل' });
        }
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة الصنف' });
    }
};
