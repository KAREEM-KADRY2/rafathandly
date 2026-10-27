const db = require('../db');
const auditLogger = require('./auditLogger');

exports.getAllCustomers = (req, res) => {
    try {
        if (req.query.all === 'true' || (!req.query.page && !req.query.limit && !req.query.search)) {
            const customers = db.prepare('SELECT id, name, phone, default_credit_deadline FROM customers ORDER BY name ASC').all();
            return res.json(customers);
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : '';
        const sortByParam = req.query.sortBy || 'id';
        const sortOrderParam = (req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const allowedSortColumns = {
            id: 'c.id',
            name: 'c.name',
            phone: 'c.phone',
            created_at: 'c.created_at',
            total_outstanding: 'total_outstanding'
        };

        const sortColumn = allowedSortColumns[sortByParam] || 'c.id';

        let whereClause = '';
        const params = [];

        if (search) {
            whereClause = ` WHERE (c.name LIKE ? OR c.phone LIKE ? OR c.alt_phone LIKE ? OR c.address LIKE ? OR c.national_id LIKE ?)`;
            const sParam = `%${search}%`;
            params.push(sParam, sParam, sParam, sParam, sParam);
        }

        const countStmt = db.prepare(`SELECT COUNT(*) as total FROM customers c${whereClause}`);
        const total = countStmt.get(...params).total;

        const query = `
            SELECT c.*,
                   (
                       COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id), 0) +
                       COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED'), 0) -
                       COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) -
                       COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = c.id), 0)
                   ) AS total_outstanding,
                   COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED'), 0) AS total_credit_sales,
                   COALESCE((SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) FROM customer_payments WHERE customer_id = c.id), 0) AS total_paid,
                   COALESCE((SELECT COUNT(*) FROM credit_sales WHERE customer_id = c.id AND remaining_amount > 0 AND date('now', '+3 hours') > date(due_date)), 0) AS overdue_sales_count,
                   COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = c.id AND remaining_amount > 0 AND date('now', '+3 hours') > date(due_date)), 0) AS overdue_amount,
                   COALESCE((SELECT COUNT(*) FROM credit_sales WHERE customer_id = c.id AND remaining_amount > 0 AND date('now', '+3 hours') <= date(due_date)), 0) AS active_sales_count,
                   (SELECT MIN(due_date) FROM credit_sales WHERE customer_id = c.id AND remaining_amount > 0) AS nearest_due_date
            FROM customers c
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrderParam}
            LIMIT ? OFFSET ?
        `;

        const items = db.prepare(query).all(...params, limit, offset);
        const totalPages = Math.ceil(total / limit) || 1;

        res.json({
            items,
            total,
            page,
            limit,
            totalPages
        });
    } catch (error) {
        console.error('Error in getAllCustomers:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getCustomerById = (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare(`
            SELECT c.*,
                   (
                       COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id), 0) +
                       COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED'), 0) -
                       COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) -
                       COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = c.id), 0)
                   ) AS total_outstanding,
                   COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED'), 0) AS total_credit_sales,
                   COALESCE((SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) FROM customer_payments WHERE customer_id = c.id), 0) AS total_paid,
                   COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = c.id AND remaining_amount > 0 AND date('now', '+3 hours') > date(due_date)), 0) AS overdue_amount,
                   COALESCE((SELECT COUNT(*) FROM credit_sales WHERE customer_id = c.id AND remaining_amount > 0 AND date('now', '+3 hours') > date(due_date)), 0) AS overdue_sales_count,
                   COALESCE((SELECT COUNT(*) FROM credit_sales WHERE customer_id = c.id AND remaining_amount > 0 AND date('now', '+3 hours') <= date(due_date)), 0) AS active_sales_count,
                   (SELECT MIN(due_date) FROM credit_sales WHERE customer_id = c.id AND remaining_amount > 0) AS nearest_due_date
            FROM customers c
            WHERE c.id = ?
        `);
        const customer = stmt.get(id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createCustomer = (req, res) => {
    try {
        const { name, phone, alt_phone, address, national_id, notes, default_credit_deadline } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'اسم العميل مطلوب' });
        }
        
        const stmt = db.prepare(`
            INSERT INTO customers (name, phone, alt_phone, address, national_id, notes, default_credit_deadline)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            name.trim(), 
            phone || null, 
            alt_phone || null, 
            address || null, 
            national_id || null, 
            notes || null, 
            default_credit_deadline || 3
        );
        
        res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), phone: phone || null, message: 'Customer created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCustomer = (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, alt_phone, address, national_id, notes, default_credit_deadline, status } = req.body;
        
        const stmt = db.prepare(`
            UPDATE customers 
            SET name = ?, phone = ?, alt_phone = ?, address = ?, national_id = ?, notes = ?, default_credit_deadline = ?, status = ?
            WHERE id = ?
        `);
        
        stmt.run(name, phone, alt_phone, address, national_id, notes, default_credit_deadline, status, id);
        res.json({ message: 'Customer updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCustomerAccountStatement = (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        let query = `
            SELECT t.*, 
                   s.invoice_number,
                   p.reference_number as payment_reference
            FROM customer_account_transactions t
            LEFT JOIN credit_sales s ON t.credit_sale_id = s.id
            LEFT JOIN customer_payments p ON t.payment_id = p.id
            WHERE t.customer_id = ?
        `;
        const params = [id];
        
        if (startDate) { query += ' AND date(t.transaction_date) >= date(?)'; params.push(startDate); }
        if (endDate) { query += ' AND date(t.transaction_date) <= date(?)'; params.push(endDate); }
        
        query += ' ORDER BY t.transaction_date ASC, t.id ASC';

        const stmt = db.prepare(query);
        const transactions = stmt.all(...params);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.getWhatsappStatement = (req, res) => {
    try {
        const { id } = req.params;

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
        if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

        const latestSale = db.prepare(`
            SELECT * FROM credit_sales 
            WHERE customer_id = ? AND status != 'CANCELLED' 
            ORDER BY sale_date DESC, created_at DESC, id DESC 
            LIMIT 1
        `).get(id);

        if (!latestSale) {
            return res.status(400).json({ error: 'لا توجد فواتير مبيعات مكتملة لهذا العميل' });
        }

        const obRow = db.prepare("SELECT balance_type, amount FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?").get(id);
        const openingBal = obRow ? (obRow.balance_type === 'debit' ? obRow.amount : -obRow.amount) : 0;

        const currentBalStmt = db.prepare(`
            SELECT 
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) +
                COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = ?), 0)
            AS total
        `);
        const current_customer_balance = currentBalStmt.get(id, id, id, id).total;
        const previous_customer_balance = current_customer_balance - latestSale.remaining_amount;

        const rawItems = db.prepare('SELECT * FROM credit_sale_items WHERE credit_sale_id = ?').all(latestSale.id);
        const invItems = db.prepare('SELECT name, unit, secondary_unit, conversion_factor, conversion_operator FROM inventory_items').all();

        const normalizeArabic = (str) => {
            if (!str) return '';
            let s = String(str).trim()
                .replace(/[أإآ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/ى/g, 'ي');
            if (s === 'شيكاره' || s === 'شيكارة' || s === 'شكاره' || s === 'شكارة') return 'شكاره';
            if (s === 'كجم' || s === 'كيلوجرام' || s === 'كيلو جرام') return 'كيلو';
            return s;
        };

        const items = rawItems.map(item => {
            let equivText = null;
            const normItemName = normalizeArabic(item.item_name);
            const inv = invItems.find(i => i.name === item.item_name || normalizeArabic(i.name) === normItemName);

            if (inv && inv.secondary_unit && inv.conversion_factor) {
                const factor = parseFloat(inv.conversion_factor);
                const op = inv.conversion_operator || '/';
                const normUnit = normalizeArabic(item.unit);
                const normSec = normalizeArabic(inv.secondary_unit);
                const normBase = normalizeArabic(inv.unit);

                if (normUnit === normSec || item.unit === inv.secondary_unit) {
                    const baseQty = op === '*' ? item.quantity * factor : item.quantity / factor;
                    const cleanBase = Math.round(baseQty * 10000) / 10000;
                    equivText = cleanBase + ' ' + inv.unit;
                } else if (normUnit === normBase || item.unit === inv.unit) {
                    const secQty = op === '*' ? item.quantity / factor : item.quantity * factor;
                    const cleanSec = Math.round(secQty * 10000) / 10000;
                    equivText = cleanSec + ' ' + inv.secondary_unit;
                }
            }
            return {
                ...item,
                equivalent_text: equivText
            };
        });

        const payments = db.prepare('SELECT * FROM customer_payments WHERE credit_sale_id = ? ORDER BY payment_date DESC').all(latestSale.id);

        res.json({
            sale: {
                ...latestSale,
                customer_name: customer.name,
                customer_phone: customer.phone,
                items,
                payments,
                previous_customer_balance,
                current_customer_balance,
                opening_balance: obRow ? {
                    amount: Number(obRow.amount) || 0,
                    balance_type: obRow.balance_type || 'debit',
                    effective_date: obRow.effective_date,
                    notes: obRow.notes
                } : null
            },
            customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                address: customer.address
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteCustomer = (req, res) => {
    try {
        const { id } = req.params;
        const customer = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(id);
        if (!customer) {
            return res.status(404).json({ error: 'العميل غير موجود' });
        }

        db.transaction(() => {
            // 1. Decouple transport trips
            db.prepare('UPDATE transport_trips SET customer_id = NULL WHERE customer_id = ?').run(id);

            // 2. Decouple inventory movements
            db.prepare('UPDATE inventory_movements SET customer_id = NULL WHERE customer_id = ?').run(id);

            // 3. Decouple treasury transactions
            db.prepare("UPDATE treasury_transactions SET related_entity_id = NULL WHERE related_entity_type = 'customer' AND related_entity_id = ?").run(id);

            // 4. Delete opening balance
            db.prepare("DELETE FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?").run(id);

            // 5. Delete customer item prices
            db.prepare('DELETE FROM customer_item_prices WHERE customer_id = ?').run(id);

            // 6. Delete customer account transactions
            db.prepare('DELETE FROM customer_account_transactions WHERE customer_id = ?').run(id);

            // 7. Delete customer adjustments
            db.prepare('DELETE FROM customer_adjustments WHERE customer_id = ?').run(id);

            // 8. Delete credit sale items for all customer sales
            const sales = db.prepare('SELECT id FROM credit_sales WHERE customer_id = ?').all(id);
            for (const s of sales) {
                db.prepare('DELETE FROM credit_sale_items WHERE credit_sale_id = ?').run(s.id);
            }

            // 9. Delete customer payments
            db.prepare('DELETE FROM customer_payments WHERE customer_id = ?').run(id);

            // 10. Delete credit sales
            db.prepare('DELETE FROM credit_sales WHERE customer_id = ?').run(id);

            // 11. Delete customer
            db.prepare('DELETE FROM customers WHERE id = ?').run(id);

            // Log action
            auditLogger.logAction(
                'مستخدم النظام',
                'DELETE',
                'العملاء',
                'CUSTOMERS',
                id.toString(),
                `حذف العميل ${customer.name} وجميع عملياته نهائياً`,
                customer,
                null
            );
        })();

        res.json({ success: true, message: 'تم حذف العميل وجميع سجلاته بنجاح' });
    } catch (error) {
        console.error('Error in deleteCustomer:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.createAdjustment = (req, res) => {
    const { id } = req.params;
    const { amount, credit_sale_id, adjustment_date, reason, notes, reference_number } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'المبلغ يجب أن يكون رقماً موجباً أكبر من الصفر' });
    }

    try {
        const customer = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(id);
        if (!customer) {
            return res.status(404).json({ error: 'العميل غير موجود' });
        }

        const txDate = adjustment_date || new Date().toISOString();
        const adjReason = reason || 'خصم زارة';
        const adjNotes = notes || '';
        const refNo = reference_number || '';

        let adjustmentId;
        let newBalance;

        db.transaction(() => {
            let targetSaleId = credit_sale_id ? parseInt(credit_sale_id) : null;

            if (targetSaleId) {
                const sale = db.prepare('SELECT id, customer_id, original_amount, paid_amount, zara_amount, remaining_amount, status FROM credit_sales WHERE id = ?').get(targetSaleId);
                if (!sale) {
                    throw new Error('فاتورة المبيعات غير موجودة');
                }
                if (sale.customer_id != id) {
                    throw new Error('فاتورة المبيعات لا تتبع هذا العميل');
                }
                if (sale.status === 'CANCELLED') {
                    throw new Error('لا يمكن تطبيق تسوية زارة على فاتورة ملغاة');
                }
                if (numAmount > sale.remaining_amount) {
                    throw new Error(`مبلغ الخصم المطلوب (${numAmount.toLocaleString()} ج.م) أكبر من المتبقي على الفاتورة (${sale.remaining_amount.toLocaleString()} ج.م)`);
                }

                const newZara = (sale.zara_amount || 0) + numAmount;
                const newRemaining = sale.remaining_amount - numAmount;
                const newStatus = newRemaining === 0 ? 'PAID' : (sale.paid_amount > 0 ? 'PARTIALLY_PAID' : sale.status);

                db.prepare(`
                    UPDATE credit_sales 
                    SET zara_amount = ?, remaining_amount = ?, status = ?
                    WHERE id = ?
                `).run(newZara, newRemaining, newStatus, targetSaleId);

            } else {
                // General customer adjustment: Allocate FIFO across open credit sales
                let unallocated = numAmount;
                const openSales = db.prepare(`
                    SELECT id, remaining_amount, paid_amount, zara_amount, status 
                    FROM credit_sales 
                    WHERE customer_id = ? AND status != 'CANCELLED' AND remaining_amount > 0 
                    ORDER BY date(sale_date) ASC, id ASC
                `).all(id);

                for (const sale of openSales) {
                    if (unallocated <= 0) break;
                    const deduct = Math.min(unallocated, sale.remaining_amount);
                    const newZara = (sale.zara_amount || 0) + deduct;
                    const newRemaining = sale.remaining_amount - deduct;
                    const newStatus = newRemaining === 0 ? 'PAID' : (sale.paid_amount > 0 ? 'PARTIALLY_PAID' : sale.status);

                    db.prepare('UPDATE credit_sales SET zara_amount = ?, remaining_amount = ?, status = ? WHERE id = ?')
                        .run(newZara, newRemaining, newStatus, sale.id);

                    unallocated -= deduct;
                    if (!targetSaleId) targetSaleId = sale.id;
                }
            }

            // Insert into customer_adjustments
            const adjCols = db.prepare("PRAGMA table_info(customer_adjustments)").all().map(c => c.name);
            let insertSql;
            let insertParams;

            if (adjCols.includes('period_id')) {
                insertSql = `
                    INSERT INTO customer_adjustments (customer_id, credit_sale_id, type, amount, adjustment_date, reason, reference_number, notes, recorded_by, period_id)
                    VALUES (?, ?, 'ZARA', ?, ?, ?, ?, ?, ?, 1)
                `;
                insertParams = [id, targetSaleId, numAmount, txDate, adjReason, refNo, adjNotes, 'مستخدم النظام'];
            } else {
                insertSql = `
                    INSERT INTO customer_adjustments (customer_id, credit_sale_id, type, amount, adjustment_date, reason, reference_number, notes, recorded_by)
                    VALUES (?, ?, 'ZARA', ?, ?, ?, ?, ?, ?)
                `;
                insertParams = [id, targetSaleId, numAmount, txDate, adjReason, refNo, adjNotes, 'مستخدم النظام'];
            }

            const adjRes = db.prepare(insertSql).run(...insertParams);
            adjustmentId = adjRes.lastInsertRowid;

            // Recalculate customer current balance
            const balRow = db.prepare(`
                SELECT 
                    COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0)
                    + COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0)
                AS current_balance
            `).get(id, id);
            newBalance = balRow ? balRow.current_balance : 0;

            // Insert into customer_account_transactions
            const desc = targetSaleId ? `خصم زارة لفاتورة #${targetSaleId}` : `تسوية زارة (خصم مسموح به)`;
            const fullNotes = adjNotes ? `${desc} - ${adjNotes}` : desc;

            db.prepare(`
                INSERT INTO customer_account_transactions (customer_id, credit_sale_id, adjustment_id, transaction_type, amount, balance_after, transaction_date, notes)
                VALUES (?, ?, ?, 'ZARA', ?, ?, ?, ?)
            `).run(id, targetSaleId, adjustmentId, -numAmount, newBalance, txDate, fullNotes);

            // Audit log
            auditLogger.logAction(
                'مستخدم النظام',
                'CREATE',
                'العملاء',
                'CUSTOMERS',
                id.toString(),
                `تسوية زارة للعميل ${customer.name} بقيمة ${numAmount.toLocaleString()} ج.م`,
                null,
                { customer_id: id, credit_sale_id: targetSaleId, amount: numAmount, reason: adjReason }
            );
        })();

        res.json({
            success: true,
            message: 'تم حفظ تسوية الزارة بنجاح وتحديث رصيد العميل',
            adjustment_id: adjustmentId,
            new_balance: newBalance
        });

    } catch (error) {
        console.error('Error in createAdjustment:', error);
        res.status(400).json({ error: error.message });
    }
};

exports.deleteAdjustment = (req, res) => {
    const { id, adjustmentId } = req.params;

    try {
        db.transaction(() => {
            const adj = db.prepare('SELECT * FROM customer_adjustments WHERE id = ? AND customer_id = ?').get(adjustmentId, id);
            if (!adj) {
                throw new Error('تسوية الزارة غير موجودة');
            }

            // Reverse on credit_sales if attached to a sale
            if (adj.credit_sale_id) {
                const sale = db.prepare('SELECT * FROM credit_sales WHERE id = ?').get(adj.credit_sale_id);
                if (sale) {
                    const newZara = Math.max(0, (sale.zara_amount || 0) - adj.amount);
                    const newRemaining = sale.remaining_amount + adj.amount;
                    const newStatus = (sale.paid_amount > 0 && newRemaining > 0) ? 'PARTIALLY_PAID' : (newRemaining > 0 ? 'CONFIRMED' : 'PAID');
                    db.prepare('UPDATE credit_sales SET zara_amount = ?, remaining_amount = ?, status = ? WHERE id = ?')
                        .run(newZara, newRemaining, newStatus, sale.id);
                }
            }

            // Delete transaction from customer_account_transactions
            db.prepare('DELETE FROM customer_account_transactions WHERE adjustment_id = ?').run(adjustmentId);

            // Delete adjustment record
            db.prepare('DELETE FROM customer_adjustments WHERE id = ?').run(adjustmentId);

            // Recalculate customer balance
            const balRow = db.prepare(`
                SELECT 
                    COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0)
                    + COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0)
                AS current_balance
            `).get(id, id);
            const newBalance = balRow ? balRow.current_balance : 0;

            // Audit log
            auditLogger.logAction(
                'مستخدم النظام',
                'DELETE',
                'العملاء',
                'CUSTOMERS',
                id.toString(),
                `إلغاء تسوية زارة للعميل بقيمة ${adj.amount} ج.م`,
                adj,
                null
            );
        })();

        res.json({ success: true, message: 'تم إلغاء تسوية الزارة وإعادة احتساب الرصيد بنجاح' });
    } catch (error) {
        console.error('Error in deleteAdjustment:', error);
        res.status(400).json({ error: error.message });
    }
};

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const arabicReshaper = require('arabic-reshaper');

// Basic bi-directional helper for PDFKit
function reverseArabic(text) {
    if (!text) return '';
    try {
        const reshaped = arabicReshaper.reshape(String(text));
        return reshaped.split('').reverse().join('');
    } catch(e) {
        return text;
    }
}

exports.downloadCustomerStatementPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
        if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

        const obRow = db.prepare("SELECT balance_type, amount FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?").get(id);
        const openingBal = obRow ? (obRow.balance_type === 'debit' ? obRow.amount : -obRow.amount) : 0;
        const currentBalStmt = db.prepare(`
            SELECT 
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) +
                COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = ?), 0)
            AS total
        `);
        const currentBalance = currentBalStmt.get(id, id, id, id).total;

        let query = `
            SELECT t.*, 
                   s.invoice_number,
                   p.reference_number as payment_reference
            FROM customer_account_transactions t
            LEFT JOIN credit_sales s ON t.credit_sale_id = s.id
            LEFT JOIN customer_payments p ON t.payment_id = p.id
            WHERE t.customer_id = ?
        `;
        const params = [id];
        if (startDate) { query += ' AND date(t.transaction_date) >= date(?)'; params.push(startDate); }
        if (endDate) { query += ' AND date(t.transaction_date) <= date(?)'; params.push(endDate); }
        query += ' ORDER BY t.transaction_date ASC, t.id ASC';

        const statement = db.prepare(query).all(...params);

        const saleItems = db.prepare(`
            SELECT si.*, s.id as sale_id 
            FROM credit_sale_items si 
            JOIN credit_sales s ON si.credit_sale_id = s.id 
            WHERE s.customer_id = ?
        `).all(id);

        const tableRowsHtml = statement.map(t => {
            const date = new Date(t.transaction_date).toLocaleDateString('en-GB', { timeZone: 'Africa/Cairo' });
            
            let typeText = '';
            if (t.transaction_type === 'SALE') typeText = 'فاتورة مبيعات';
            else if (t.transaction_type === 'PAYMENT') typeText = 'تسديد دفعة';
            else if (t.transaction_type === 'ZARA') typeText = 'تعديل رصيد';
            else if (t.transaction_type === 'OPENING_BALANCE') typeText = 'رصيد افتتاحي';
            
            let displayDesc = t.notes || (t.transaction_type === 'OPENING_BALANCE' ? 'رصيد افتتاحي سابق لبدء استخدام النظام' : '-');
            
            if (t.transaction_type === 'SALE' && t.credit_sale_id) {
                const items = saleItems.filter(i => i.sale_id === t.credit_sale_id);
                if (items.length > 0) {
                    displayDesc = '<strong>' + (t.invoice_number ? 'فاتورة #' + t.invoice_number : 'فاتورة مبيعات') + '</strong>' + (t.notes ? ' - ' + t.notes : '');
                    displayDesc += '<div class="items-container"><table class="items-table">';
                    displayDesc += '<tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>';
                    displayDesc += items.map(i => '<tr>' +
                        '<td>' + i.item_name + '</td>' +
                        '<td dir="ltr">' + i.quantity + ' ' + (i.unit || '') + '</td>' +
                        '<td dir="ltr">' + i.unit_price + '</td>' +
                        '<td dir="ltr" style="font-weight: 600;">' + i.total_price + '</td>' +
                    '</tr>').join('');
                    displayDesc += '</table></div>';
                }
            }

            return '<tr>' +
                '<td dir="ltr" style="white-space: nowrap;">' + date + '</td>' +
                '<td>' + typeText + '</td>' +
                '<td>' + displayDesc + '</td>' +
                '<td dir="ltr" class="amount-val">' + (t.amount > 0 ? t.amount.toLocaleString() : '-') + '</td>' +
                '<td dir="ltr" class="amount-val">' + (t.amount < 0 ? Math.abs(t.amount).toLocaleString() : '-') + '</td>' +
                '<td dir="ltr" class="amount-val ' + (t.balance_after > 0 ? 'text-red' : '') + '">' + t.balance_after.toLocaleString() + '</td>' +
            '</tr>';
        }).join('');

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                
                body { font-family: 'Cairo', Tahoma, Geneva, sans-serif; padding: 0; margin: 0; color: #1e293b; background: #ffffff; }
                
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 20px;
                }
                .header h1 { margin: 0; color: #1e40af; font-size: 28px; font-weight: 700; }
                .header h2 { margin: 10px 0 0 0; color: #475569; font-size: 18px; font-weight: 600; }
                
                .info-section { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 30px; 
                }
                .info-box { 
                    background: #f8fafc; 
                    padding: 15px 20px; 
                    border-radius: 8px; 
                    border: 1px solid #cbd5e1; 
                    width: 45%; 
                    font-size: 12px;
                }
                .info-box div { margin-bottom: 5px; }
                .info-box strong { color: #0f172a; display: inline-block; width: 120px; }
                
                table.main-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 10px; 
                    font-size: 11px; 
                }
                table.main-table th { background-color: #1e40af; color: #ffffff; font-weight: 600; padding: 10px 6px; border: 1px solid #1e3a8a; text-align: center; }
                table.main-table td { padding: 10px 6px; border: 1px solid #cbd5e1; text-align: center; vertical-align: top; }
                table.main-table tr:nth-child(even) { background-color: #f1f5f9; }
                
                .items-container {
                    margin-top: 10px; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 6px; 
                    overflow: hidden;
                    background: #ffffff;
                }
                table.items-table {
                    width: 100%; 
                    border-collapse: collapse; 
                    font-size: 11px;
                }
                table.items-table th {
                    background-color: #f8fafc; 
                    color: #475569; 
                    padding: 6px 8px; 
                    border-bottom: 1px solid #e2e8f0; 
                    text-align: right;
                    font-weight: 600;
                }
                table.items-table td {
                    padding: 6px 8px; 
                    border-bottom: 1px solid #f1f5f9;
                }
                table.items-table tr:last-child td { border-bottom: none; }
                
                .summary-container {
                    background-color: #f8fafc; 
                    border: 2px solid #cbd5e1; 
                    border-radius: 12px; 
                    padding: 25px; 
                    margin-top: 40px; 
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    page-break-inside: avoid;
                }
                .summary-row {
                    display: flex; 
                    justify-content: space-between; 
                    padding-bottom: 15px;
                    margin-bottom: 15px;
                    border-bottom: 1px dashed #cbd5e1;
                    font-size: 16px;
                }
                .summary-row:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                .summary-row strong { color: #334155; }
                .final-balance {
                    font-size: 20px; 
                    font-weight: 700;
                    color: #dc2626;
                }
                
                .amount-val { font-family: Tahoma, sans-serif; font-weight: 600; }
                .text-green { color: #16a34a; }
                .text-red { color: #dc2626; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>جروب الحندقوتي</h1>
                <h2>كشف حساب عميل تفصيلي</h2>
            </div>
            
            <div class="info-section">
                <div class="info-box">
                    <div><strong>العميل:</strong> ${customer.name}</div>
                    <div><strong>الهاتف:</strong> <span dir="ltr">${customer.phone || '-'}</span></div>
                </div>
                <div class="info-box">
                    <div><strong>تاريخ الاستخراج:</strong> <span dir="ltr">${new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' })}</span></div>
                    ${(startDate || endDate) ? `<div><strong>الفترة:</strong> من <span dir="ltr">${startDate || '-'}</span> إلى <span dir="ltr">${endDate || '-'}</span></div>` : ''}
                </div>
            </div>

            <table class="main-table" style="table-layout: auto;">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>نوع الحركة</th>
                        <th>البيان</th>
                        <th>مدين (عليه)</th>
                        <th>دائن (له)</th>
                        <th>الرصيد المتبقي</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>

            <div class="summary-container">
                <div class="summary-row final-balance">
                    <span>إجمالي المديونية المستحقة على العميل:</span>
                    <span dir="ltr" class="amount-val">${currentBalance.toLocaleString()} ج.م</span>
                </div>
            </div>
        </body>
        </html>
        `;

        const fs = require('fs');
        const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
        if (fs.existsSync(chromePath)) launchOpts.executablePath = chromePath;
        else if (fs.existsSync(edgePath)) launchOpts.executablePath = edgePath;

        const puppeteer = require('puppeteer');
        let browser;
        try {
            browser = await puppeteer.launch(launchOpts);
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const pdfBuffer = await page.pdf({ 
                format: 'A4', printBackground: true, margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
            });

            res.setHeader('Content-disposition', `inline; filename=customer_statement_${id}.pdf`);
            res.setHeader('Content-type', 'application/pdf');
            res.end(pdfBuffer);
        } finally {
            if (browser) await browser.close();
        }
    } catch (error) {
        if (!res.headersSent) { res.status(500).json({ error: error.message }); } else { console.error('PDF Error:', error.message); res.end(); }
    }
}


exports.downloadCustomerStatementExcel = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
        if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

        const obRow = db.prepare("SELECT balance_type, amount FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?").get(id);
        const openingBal = obRow ? (obRow.balance_type === 'debit' ? obRow.amount : -obRow.amount) : 0;
        const currentBalStmt = db.prepare(`
            SELECT 
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) +
                COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = ?), 0)
            AS total
        `);
        const currentBalance = currentBalStmt.get(id, id, id, id).total;

        let query = `
            SELECT t.*, 
                   s.invoice_number,
                   p.reference_number as payment_reference
            FROM customer_account_transactions t
            LEFT JOIN credit_sales s ON t.credit_sale_id = s.id
            LEFT JOIN customer_payments p ON t.payment_id = p.id
            WHERE t.customer_id = ?
        `;
        const params = [id];
        if (startDate) { query += ' AND date(t.transaction_date) >= date(?)'; params.push(startDate); }
        if (endDate) { query += ' AND date(t.transaction_date) <= date(?)'; params.push(endDate); }
        query += ' ORDER BY t.transaction_date ASC, t.id ASC';

        const statement = db.prepare(query).all(...params);

        const workbook = new ExcelJS.Workbook();
        
        const sheet1 = workbook.addWorksheet('كشف الحساب', { views: [{ rightToLeft: true }] });
        sheet1.columns = [
            { header: 'التاريخ', key: 'date', width: 15 },
            { header: 'نوع الحركة', key: 'type', width: 20 },
            { header: 'رقم المستند', key: 'ref', width: 20 },
            { header: 'البيان', key: 'notes', width: 30 },
            { header: 'عليه', key: 'owed', width: 15 },
            { header: 'المدفوع', key: 'paid', width: 15 },
            { header: 'الرصيد المتبقي', key: 'balance', width: 15 }
        ];

        sheet1.getRow(1).font = { name: 'Arial', bold: true, size: 12 };
        sheet1.getRow(1).alignment = { horizontal: 'center' };

        statement.forEach(t => {
            let type = t.transaction_type;
            if (type === 'SALE') type = 'فاتورة مبيعات';
            else if (type === 'PAYMENT') type = 'سداد دفعة';
            else if (type === 'ZARA') type = 'خصم / تسوية';
            else if (type === 'OPENING_BALANCE') type = 'رصيد افتتاحي';

            const row = sheet1.addRow({
                date: new Date(t.transaction_date).toLocaleDateString('en-GB'),
                type: type,
                ref: t.invoice_number || t.payment_reference || '-',
                notes: t.notes || '-',
                owed: t.amount > 0 ? t.amount : 0,
                paid: t.amount < 0 ? Math.abs(t.amount) : 0,
                balance: t.balance_after
            });
            row.font = { name: 'Arial', size: 11 };
            row.alignment = { horizontal: 'right' };
        });

        const sheet2 = workbook.addWorksheet('ملخص الحساب', { views: [{ rightToLeft: true }] });
        sheet2.columns = [{ width: 25 }, { width: 40 }];
        const r1 = sheet2.addRow(['اسم العميل', customer.name]);
        const r2 = sheet2.addRow(['رقم الهاتف', customer.phone || '-']);
        const r3 = sheet2.addRow(['الرصيد الافتتاحي', openingBal]);
        const r4 = sheet2.addRow(['إجمالي الرصيد المتبقي', currentBalance]);
        const r5 = sheet2.addRow(['تاريخ استخراج التقرير', new Date().toLocaleString('en-GB')]);

        [r1, r2, r3, r4, r5].forEach(row => {
            row.font = { name: 'Arial', size: 12, bold: true };
            row.alignment = { horizontal: 'right' };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `inline; filename=customer_statement_${id}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
