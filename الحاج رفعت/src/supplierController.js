const db = require('../db');

exports.getAllSuppliers = (req, res) => {
    try {
        if (req.query.all === 'true' || (!req.query.page && !req.query.limit && !req.query.search)) {
            const suppliers = db.prepare('SELECT id, name, type, phone FROM suppliers ORDER BY name ASC').all();
            return res.json(suppliers);
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : '';
        const sortByParam = req.query.sortBy || 'id';
        const sortOrderParam = (req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const allowedSortColumns = {
            id: 's.id',
            name: 's.name',
            type: 's.type',
            created_at: 's.created_at',
            balance: 's.balance'
        };

        const sortColumn = allowedSortColumns[sortByParam] || 's.id';

        let whereClause = '';
        const params = [];

        if (search) {
            whereClause = ` WHERE (s.name LIKE ? OR s.phone LIKE ? OR s.alt_phone LIKE ? OR s.type LIKE ? OR s.contact_person LIKE ? OR s.address LIKE ?)`;
            const sParam = `%${search}%`;
            params.push(sParam, sParam, sParam, sParam, sParam, sParam);
        }

        const countStmt = db.prepare(`SELECT COUNT(*) as total FROM suppliers s${whereClause}`);
        const total = countStmt.get(...params).total;

        const query = `
            SELECT s.*, 
                   COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id), 0) AS total_purchases,
                   COALESCE((
                       SELECT SUM(
                           CASE 
                               WHEN pi.base_unit LIKE '%طن%' THEN pi.base_quantity
                               WHEN pi.unit LIKE '%طن%' THEN pi.quantity
                               WHEN pi.unit LIKE '%كيلو%' OR pi.unit LIKE '%كجم%' THEN pi.quantity / 1000.0
                               WHEN pi.unit LIKE '%شكارة%' OR pi.unit LIKE '%شيكارة%' THEN pi.quantity / 20.0
                               ELSE 0
                           END
                       )
                       FROM purchase_items pi
                       JOIN purchases p ON pi.purchase_id = p.id
                       WHERE p.supplier_id = s.id
                   ), 0) AS total_tons
            FROM suppliers s 
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrderParam}
            LIMIT ? OFFSET ?
        `;

        const suppliers = db.prepare(query).all(...params, limit, offset);

        if (suppliers.length > 0) {
            const supplierIds = suppliers.map(s => s.id);
            const placeholders = supplierIds.map(() => '?').join(',');
            const items = db.prepare(`SELECT * FROM supplier_items WHERE supplier_id IN (${placeholders})`).all(...supplierIds);
            
            const itemsBySupplier = {};
            for (const item of items) {
                if (!itemsBySupplier[item.supplier_id]) itemsBySupplier[item.supplier_id] = [];
                itemsBySupplier[item.supplier_id].push(item.item_name);
            }

            for (const s of suppliers) {
                s.items = itemsBySupplier[s.id] || [];
            }
        }

        const totalPages = Math.ceil(total / limit) || 1;

        res.json({
            items: suppliers,
            total,
            page,
            limit,
            totalPages
        });
    } catch (error) {
        console.error('Error in getAllSuppliers:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getSupplierById = (req, res) => {
    try {
        const supplier = db.prepare(`
            SELECT s.*,
                   COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id), 0) AS total_purchases,
                   COALESCE((SELECT COUNT(*) FROM transport_trips WHERE supplier_id = s.id), 0) AS trips_count,
                   COALESCE((
                       SELECT SUM(
                           CASE 
                               WHEN pi.base_unit LIKE '%طن%' THEN pi.base_quantity
                               WHEN pi.unit LIKE '%طن%' THEN pi.quantity
                               WHEN pi.unit LIKE '%كيلو%' OR pi.unit LIKE '%كجم%' THEN pi.quantity / 1000.0
                               WHEN pi.unit LIKE '%شكارة%' OR pi.unit LIKE '%شيكارة%' THEN pi.quantity / 20.0
                               ELSE 0
                           END
                       )
                       FROM purchase_items pi
                       JOIN purchases p ON pi.purchase_id = p.id
                       WHERE p.supplier_id = s.id
                   ), 0) AS total_tons
            FROM suppliers s 
            WHERE s.id = ?
        `).get(req.params.id);
        
        if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });
        
        const items = db.prepare('SELECT * FROM supplier_items WHERE supplier_id = ?').all(req.params.id);
        res.json({ ...supplier, items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSupplier = (req, res) => {
    const { name, type, contact_person, phone, alt_phone, address, governorate, default_credit_deadline = 3, notes, items } = req.body;
    try {
        const insertSupplier = db.prepare(`
            INSERT INTO suppliers (name, type, contact_person, phone, alt_phone, address, governorate, default_credit_deadline, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertItem = db.prepare('INSERT INTO supplier_items (supplier_id, item_name) VALUES (?, ?)');
        
        const transaction = db.transaction(() => {
            const result = insertSupplier.run(
                name,
                type || 'مورد عام',
                contact_person || null,
                phone || null,
                alt_phone || null,
                address || null,
                governorate || null,
                Number(default_credit_deadline) || 3,
                notes || null
            );
            const supplierId = result.lastInsertRowid;
            
            if (items && Array.isArray(items)) {
                for (const item of items) {
                    insertItem.run(supplierId, item);
                }
            }
            
            return supplierId;
        });

        const newId = transaction();
        res.status(201).json({ id: newId, message: 'تم إضافة المورد بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSupplierAccountStatement = (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        let query = `
            SELECT sbt.id, sbt.supplier_id, sbt.created_at as transaction_date,
                   CASE WHEN sbt.transaction_type = 'purchase' THEN 'PURCHASE'
                        WHEN sbt.transaction_type = 'deposit' THEN 'PAYMENT'
                        WHEN sbt.transaction_type = 'opening_balance' THEN 'OPENING_BALANCE'
                        ELSE 'OTHER' END as transaction_type,
                   sbt.reference_number as purchase_invoice_number,
                   sbt.description as notes,
                   sbt.amount,
                   p.id as actual_purchase_id
            FROM supplier_balance_transactions sbt
            LEFT JOIN purchases p ON p.supplier_id = sbt.supplier_id 
                 AND sbt.transaction_type = 'purchase' 
                 AND (p.invoice_number = sbt.reference_number OR CAST(p.id AS TEXT) = sbt.reference_number)
            WHERE sbt.supplier_id = ?
        `;
        const params = [id];

        if (startDate) {
            query += ' AND date(sbt.created_at) >= date(?)';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND date(sbt.created_at) <= date(?)';
            params.push(endDate);
        }

        query += ' ORDER BY sbt.created_at ASC, sbt.id ASC';
        
        const transactions = db.prepare(query).all(...params);

        let runningBalance = 0;
        const enriched = transactions.map(t => {
            runningBalance += t.amount;
            return { ...t, balance_after: runningBalance };
        });

        // The UI expects DESC order
        enriched.reverse();

        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSupplierSummary = (req, res) => {
    try {
        const { id } = req.params;
        const supplier = db.prepare(`
            SELECT s.*,
                   COALESCE((
                       SELECT SUM(
                           CASE 
                               WHEN pi.base_unit LIKE '%طن%' THEN pi.base_quantity
                               WHEN pi.unit LIKE '%طن%' THEN pi.quantity
                               WHEN pi.unit LIKE '%كيلو%' OR pi.unit LIKE '%كجم%' THEN pi.quantity / 1000.0
                               WHEN pi.unit LIKE '%شكارة%' OR pi.unit LIKE '%شيكارة%' THEN pi.quantity / 20.0
                               ELSE 0
                           END
                       )
                       FROM purchase_items pi
                       JOIN purchases p ON pi.purchase_id = p.id
                       WHERE p.supplier_id = s.id
                   ), 0) AS total_tons
            FROM suppliers s WHERE s.id = ?
        `).get(id);
        if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });

        const summary = db.prepare(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_purchases,
                COALESCE(SUM(paid_amount), 0) as total_paid,
                COALESCE(SUM(remaining_amount), 0) as total_remaining,
                COUNT(*) as purchases_count
            FROM purchases 
            WHERE supplier_id = ?
        `).get(id);

        const nolonSummary = db.prepare(`
            SELECT COALESCE(SUM(nawlon_cost), 0) as total_nawlon 
            FROM transport_trips 
            WHERE supplier_id = ?
        `).get(id);

        let total_deposits = 0;
        let total_paid = summary.total_paid;
        if (supplier.type === 'مصنع') {
            const deposits = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total_deposits FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit' AND amount > 0`).get(id);
            total_deposits = deposits.total_deposits;
        } else {
            const deposits = db.prepare(`SELECT COALESCE(SUM(ABS(amount)), 0) as total_deposits FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit' AND amount < 0`).get(id);
            if (deposits.total_deposits > 0) {
                total_paid = Math.max(summary.total_paid, deposits.total_deposits);
            }
        }

        res.json({
            ...supplier,
            total_purchases: summary.total_purchases,
            total_paid: total_paid,
            total_remaining: supplier.balance,
            purchases_count: summary.purchases_count,
            total_nawlon: nolonSummary.total_nawlon,
            total_deposits: total_deposits
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

exports.updateSupplier = (req, res) => {
    const { name, type, contact_person, phone, alt_phone, address, governorate, default_credit_deadline, notes, items } = req.body;
    try {
        const transaction = db.transaction(() => {
            db.prepare(`
                UPDATE suppliers 
                SET name = ?, type = ?, contact_person = ?, phone = ?, alt_phone = ?, address = ?, governorate = ?, default_credit_deadline = ?, notes = ?
                WHERE id = ?
            `).run(name, type, contact_person, phone, alt_phone, address, governorate, Number(default_credit_deadline) || 3, notes, req.params.id);

            if (items && Array.isArray(items)) {
                db.prepare('DELETE FROM supplier_items WHERE supplier_id = ?').run(req.params.id);
                const insertItem = db.prepare('INSERT INTO supplier_items (supplier_id, item_name) VALUES (?, ?)');
                for (const item of items) {
                    insertItem.run(req.params.id, item);
                }
            }
        });
        transaction();
        res.json({ message: 'تم تحديث بيانات المورد بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.toggleSupplierStatus = (req, res) => {
    const { status } = req.body;
    try {
        db.prepare('UPDATE suppliers SET status = ? WHERE id = ?').run(status, req.params.id);
        res.json({ message: 'تم تحديث الحالة' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSupplierBalance = (req, res) => {
    try {
        const supplier = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(req.params.id);
        if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });
        res.json({ balance: supplier.balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.depositBalance = (req, res) => {
    const { amount, reference_number, description, payment_method } = req.body;
    const supplierId = req.params.id;

    if (amount <= 0) return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من صفر' });

    try {
        const transaction = db.transaction(() => {
            db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(amount, supplierId);
            
            db.prepare(`
                INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description) 
                VALUES (?, ?, 'deposit', ?, ?)
            `).run(supplierId, amount, reference_number, description);
            
            const treasuryController = require('./treasuryController');
            treasuryController.recordTransaction({
                type: 'OUT',
                party_type: 'supplier',
                party_id: supplierId,
                amount: amount,
                description: description || 'إيداع رصيد مورد',
                reference_type: 'supplier_deposit',
                reference_id: supplierId,
                payment_method: payment_method
            });
            
            return db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(supplierId).balance;
        });

        const newBalance = transaction();
        res.json({ balance: newBalance, message: 'تم إضافة الرصيد بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTransactions = (req, res) => {
    try {
        const transactions = db.prepare('SELECT * FROM supplier_balance_transactions WHERE supplier_id = ? ORDER BY created_at DESC').all(req.params.id);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.downloadSupplierStatementPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
        if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });

        const isFactory = supplier.type === 'مصنع';

        // 1. Fetch Transactions
        let query = `
            SELECT sbt.id, sbt.supplier_id, sbt.created_at as transaction_date,
                   CASE WHEN sbt.transaction_type = 'purchase' THEN 'PURCHASE'
                        WHEN sbt.transaction_type = 'deposit' THEN 'PAYMENT'
                        WHEN sbt.transaction_type = 'opening_balance' THEN 'OPENING_BALANCE'
                        ELSE 'OTHER' END as transaction_type,
                   sbt.reference_number as purchase_invoice_number,
                   sbt.description as notes,
                   sbt.amount,
                   p.id as actual_purchase_id
            FROM supplier_balance_transactions sbt
            LEFT JOIN purchases p ON p.supplier_id = sbt.supplier_id 
                 AND sbt.transaction_type = 'purchase' 
                 AND (p.invoice_number = sbt.reference_number OR CAST(p.id AS TEXT) = sbt.reference_number)
            WHERE sbt.supplier_id = ?
        `;
        const params = [id];
        if (startDate) { query += ' AND date(sbt.created_at) >= date(?)'; params.push(startDate); }
        if (endDate) { query += ' AND date(sbt.created_at) <= date(?)'; params.push(endDate); }
        query += ' ORDER BY sbt.created_at ASC, sbt.id ASC';

        const statement = db.prepare(query).all(...params);

        const purchaseItems = db.prepare(`
            SELECT pi.*, p.id as p_id 
            FROM purchase_items pi 
            JOIN purchases p ON pi.purchase_id = p.id 
            WHERE p.supplier_id = ?
        `).all(id);

        let runningBalance = 0;
        const processedStatement = statement.map(t => {
            if (isFactory) {
                if (t.transaction_type === 'PURCHASE') {
                    runningBalance -= Math.abs(t.amount);
                } else if (t.transaction_type === 'PAYMENT') {
                    runningBalance += Math.abs(t.amount);
                } else {
                    runningBalance += t.amount; 
                }
            } else {
                if (t.transaction_type === 'PURCHASE') {
                    runningBalance += Math.abs(t.amount);
                } else if (t.transaction_type === 'PAYMENT') {
                    runningBalance -= Math.abs(t.amount);
                } else {
                    runningBalance += t.amount;
                }
            }
            return { ...t, balance_after: runningBalance };
        });

        const totalPurchases = processedStatement.filter(t => t.transaction_type === 'PURCHASE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalPayments = processedStatement.filter(t => t.transaction_type === 'PAYMENT').reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const tonsStmt = db.prepare(`
            SELECT COALESCE(SUM(
                CASE 
                    WHEN pi.base_unit LIKE '%طن%' THEN pi.base_quantity
                    WHEN pi.unit LIKE '%طن%' THEN pi.quantity
                    WHEN pi.unit LIKE '%كيلو%' OR pi.unit LIKE '%كجم%' THEN pi.quantity / 1000.0
                    WHEN pi.unit LIKE '%شكارة%' OR pi.unit LIKE '%شيكارة%' THEN pi.quantity / 20.0
                    ELSE 0
                END
            ), 0) as total_tons
            FROM purchase_items pi
            JOIN purchases p ON pi.purchase_id = p.id
            WHERE p.supplier_id = ?
        `).get(id);
        const totalTons = tonsStmt ? tonsStmt.total_tons : 0;

        let logoBase64 = '';
        try {
            const fsReq = require('fs');
            const pathReq = require('path');
            const p1 = pathReq.join(__dirname, '../../frontend/public/logo.jpg');
            const p2 = pathReq.join(__dirname, '../../frontend/dist/logo.jpg');
            if (fsReq.existsSync(p1)) {
                logoBase64 = `data:image/jpeg;base64,${fsReq.readFileSync(p1).toString('base64')}`;
            } else if (fsReq.existsSync(p2)) {
                logoBase64 = `data:image/jpeg;base64,${fsReq.readFileSync(p2).toString('base64')}`;
            }
        } catch (e) {}

        const tableRowsHtml = processedStatement.map(t => {
            const dateStr = new Date(t.transaction_date).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
            
            let typeBadge = '';
            let invoiceNumberDisplay = t.purchase_invoice_number || (t.actual_purchase_id ? `#${t.actual_purchase_id}` : '-');

            if (t.transaction_type === 'PURCHASE') {
                typeBadge = `<span class="type-tag tag-purchase">فاتورة شراء</span>`;
            } else if (t.transaction_type === 'PAYMENT') {
                typeBadge = isFactory 
                    ? `<span class="type-tag tag-deposit">إضافة رصيد للمصنع</span>` 
                    : `<span class="type-tag tag-payment">تسديد دفعة</span>`;
            } else if (t.transaction_type === 'OPENING_BALANCE') {
                typeBadge = `<span class="type-tag tag-deposit">رصيد افتتاحي</span>`;
            } else {
                typeBadge = `<span class="type-tag tag-other">حركة أخرى</span>`;
            }

            let notesDisplay = t.notes ? `<div class="tx-notes">${t.notes}</div>` : '';

            let itemsHtml = '';
            if (t.transaction_type === 'PURCHASE' && t.actual_purchase_id) {
                const items = purchaseItems.filter(i => i.p_id === t.actual_purchase_id);
                if (items.length > 0) {
                    itemsHtml = `
                        <div class="items-table-wrapper">
                            <table class="items-subtable">
                                <thead>
                                    <tr>
                                        <th>الصنف</th>
                                        <th>الكمية والوحدة</th>
                                        <th>السعر</th>
                                        <th>الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(i => {
                                        let qtyText = `${Number(i.quantity).toLocaleString()} ${i.unit || ''}`;
                                        if (i.base_unit && i.base_unit !== i.unit && i.base_quantity) {
                                            qtyText += ` <span class="conversion-text">(ما يعادل ${Number(i.base_quantity).toLocaleString()} ${i.base_unit})</span>`;
                                        }
                                        return `
                                            <tr>
                                                <td><strong>${i.item_name || 'صنف'}</strong></td>
                                                <td>${qtyText}</td>
                                                <td dir="ltr">${Number(i.unit_price).toLocaleString()} ج.م</td>
                                                <td dir="ltr" style="font-weight: 700;">${Number(i.total_price).toLocaleString()} ج.م</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            }

            const absAmt = Math.abs(t.amount);
            let col1Val = '-';
            let col2Val = '-';

            if (isFactory) {
                if (t.transaction_type === 'PAYMENT') col1Val = `${absAmt.toLocaleString()} ج.م`;
                else if (t.transaction_type === 'PURCHASE') col2Val = `${absAmt.toLocaleString()} ج.م`;
            } else {
                if (t.transaction_type === 'PURCHASE') col1Val = `${absAmt.toLocaleString()} ج.م`;
                else if (t.transaction_type === 'PAYMENT') col2Val = `${absAmt.toLocaleString()} ج.م`;
            }

            const balVal = t.balance_after;
            let balClass = 'bal-zero';
            if (isFactory) {
                balClass = balVal > 0 ? 'bal-positive' : (balVal < 0 ? 'bal-negative' : 'bal-zero');
            } else {
                balClass = balVal > 0 ? 'bal-negative' : (balVal < 0 ? 'bal-positive' : 'bal-zero');
            }

            return `
                <tr>
                    <td dir="ltr" class="cell-date">${dateStr}</td>
                    <td dir="ltr" class="cell-inv">${invoiceNumberDisplay}</td>
                    <td class="cell-type">${typeBadge}</td>
                    <td class="cell-desc">
                        ${notesDisplay}
                        ${itemsHtml}
                    </td>
                    <td dir="ltr" class="cell-col1">${col1Val}</td>
                    <td dir="ltr" class="cell-col2">${col2Val}</td>
                    <td dir="ltr" class="cell-bal ${balClass}">${balVal.toLocaleString()} ج.م</td>
                </tr>
            `;
        }).join('');

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                
                * { box-sizing: border-box; }
                body {
                    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                    margin: 0;
                    padding: 0;
                    color: #0f172a;
                    background: #ffffff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .header-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 14px;
                    border-bottom: 3px solid #1e3a8a;
                    margin-bottom: 16px;
                }
                .header-right { flex: 1; text-align: right; }
                .company-title {
                    font-size: 22px;
                    font-weight: 800;
                    color: #1e3a8a;
                    line-height: 1.2;
                }
                .company-subtitle {
                    font-size: 14px;
                    font-weight: 700;
                    color: #334155;
                }
                .company-tagline {
                    font-size: 10px;
                    font-weight: 600;
                    color: #64748b;
                    margin-top: 2px;
                }

                .header-center {
                    text-align: center;
                    flex: 1;
                }
                .doc-badge {
                    display: inline-block;
                    background: #1e3a8a;
                    color: #ffffff;
                    font-size: 15px;
                    font-weight: 700;
                    padding: 5px 16px;
                    border-radius: 20px;
                }
                .doc-type-tag {
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                    margin-top: 4px;
                }

                .header-left {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }
                .company-logo {
                    max-height: 65px;
                    max-width: 130px;
                    object-fit: contain;
                    margin-bottom: 4px;
                }
                .contact-info {
                    font-size: 9px;
                    color: #475569;
                    text-align: left;
                    font-weight: 600;
                }

                .info-card {
                    background: #f8fafc;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 10px 14px;
                    margin-bottom: 16px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px 14px;
                }
                .info-item {
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .info-label {
                    font-weight: 700;
                    color: #475569;
                    white-space: nowrap;
                }
                .info-value {
                    font-weight: 600;
                    color: #0f172a;
                }
                .info-value.highlight {
                    font-weight: 800;
                    color: #1e3a8a;
                    font-size: 11px;
                }
                .badge {
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 700;
                }
                .badge-supplier { background: #e0f2fe; color: #0369a1; }
                .badge-factory { background: #fef3c7; color: #b45309; }

                table.statement-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    font-size: 10px;
                    page-break-inside: auto;
                }
                table.statement-table thead {
                    display: table-header-group;
                }
                table.statement-table tr {
                    page-break-inside: avoid;
                    page-break-after: auto;
                }
                table.statement-table th {
                    background: #1e3a8a;
                    color: #ffffff;
                    font-weight: 700;
                    padding: 7px 5px;
                    border: 1px solid #1e3a8a;
                    text-align: center;
                }
                table.statement-table th.th-green { background: #15803d; border-color: #15803d; }
                table.statement-table th.th-blue { background: #1d4ed8; border-color: #1d4ed8; }
                table.statement-table th.th-red { background: #b91c1c; border-color: #b91c1c; }
                table.statement-table th.th-balance { background: #0f172a; border-color: #0f172a; }

                table.statement-table td {
                    padding: 7px 5px;
                    border: 1px solid #cbd5e1;
                    text-align: center;
                    vertical-align: top;
                }
                table.statement-table tr:nth-child(even) {
                    background-color: #f8fafc;
                }

                .type-tag {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 700;
                }
                .tag-purchase { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
                .tag-payment { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
                .tag-deposit { background: #fdf4ff; color: #a21caf; border: 1px solid #f5d0fe; }
                .tag-other { background: #f1f5f9; color: #475569; }

                .cell-date, .cell-inv { font-weight: 600; color: #334155; }
                .cell-desc { text-align: right !important; }
                .tx-notes { font-size: 9px; color: #475569; margin-bottom: 4px; }

                .items-table-wrapper {
                    margin-top: 5px;
                    border: 1px solid #cbd5e1;
                    border-radius: 5px;
                    overflow: hidden;
                    background: #ffffff;
                }
                table.items-subtable {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9px;
                }
                table.items-subtable th {
                    background: #f1f5f9;
                    color: #334155;
                    padding: 3px 5px;
                    border-bottom: 1px solid #cbd5e1;
                    text-align: right;
                    font-weight: 700;
                }
                table.items-subtable td {
                    padding: 3px 5px;
                    border-bottom: 1px solid #f1f5f9;
                    text-align: right;
                }
                table.items-subtable tr:last-child td { border-bottom: none; }
                .conversion-text { color: #0284c7; font-weight: 600; margin-right: 3px; font-size: 8px; }

                .cell-col1, .cell-col2 { font-weight: 700; }
                .cell-bal { font-weight: 800; }
                .bal-positive { color: #15803d; }
                .bal-negative { color: #b91c1c; }
                .bal-zero { color: #475569; }

                .summary-section {
                    margin-top: 16px;
                    background: #f8fafc;
                    border: 2px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 12px;
                    page-break-inside: avoid;
                }
                .summary-card-header {
                    font-size: 12px;
                    font-weight: 800;
                    color: #1e3a8a;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #cbd5e1;
                    padding-bottom: 4px;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                }
                .summary-box {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 8px;
                    text-align: center;
                }
                .summary-box-title {
                    font-size: 9px;
                    font-weight: 700;
                    color: #64748b;
                    margin-bottom: 3px;
                }
                .summary-box-value {
                    font-size: 13px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .summary-box-sub {
                    font-size: 8px;
                    color: #64748b;
                    margin-top: 2px;
                }
                .box-purchase .summary-box-value { color: #1d4ed8; }
                .box-payment .summary-box-value { color: #15803d; }
                .box-deposit .summary-box-value { color: #a21caf; }
                .box-tons .summary-box-value { color: #c2410c; }
                
                .summary-box.box-balance-final {
                    border-width: 2px;
                }
                .summary-box.final-green {
                    border-color: #86efac;
                    background: #f0fdf4;
                }
                .summary-box.final-green .summary-box-value { color: #15803d; font-size: 15px; }
                .summary-box.final-red {
                    border-color: #fca5a5;
                    background: #fef2f2;
                }
                .summary-box.final-red .summary-box-value { color: #b91c1c; font-size: 15px; }

                .empty-statement {
                    text-align: center;
                    padding: 24px;
                    font-size: 12px;
                    color: #64748b;
                    background: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    border-radius: 8px;
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="header-right">
                    <div class="company-title">الحندقوتي جروب</div>
                    <div class="company-subtitle">للصناعة والتجارة</div>
                    <div class="company-tagline">مقاولات وتوريدات مواد البناء</div>
                </div>
                <div class="header-center">
                    <div class="doc-badge">كشف حساب تفصيلي</div>
                    <div class="doc-type-tag">${isFactory ? 'حساب مصنع' : 'حساب مورد'}</div>
                </div>
                <div class="header-left">
                    ${logoBase64 ? `<img src="${logoBase64}" class="company-logo" alt="Logo" />` : ''}
                    <div class="contact-info">
                        <div>المحاسب عبد الرزاق: <span dir="ltr">01050990915</span></div>
                        <div>مصر - التجمع الخامس</div>
                    </div>
                </div>
            </div>

            <div class="info-card">
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">نوع الحساب:</span>
                        <span class="info-value badge ${isFactory ? 'badge-factory' : 'badge-supplier'}">${isFactory ? 'مصنع' : 'مورد'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">اسم ${isFactory ? 'المصنع' : 'المورد'}:</span>
                        <span class="info-value highlight">${supplier.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">رقم الهاتف:</span>
                        <span class="info-value" dir="ltr">${supplier.phone || 'غير مسجل'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">تاريخ إصدار التقرير:</span>
                        <span class="info-value" dir="ltr">${new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">رقم التقرير:</span>
                        <span class="info-value" dir="ltr">ST-${supplier.id}-${String(Date.now()).slice(-4)}</span>
                    </div>
                </div>
            </div>

            ${processedStatement.length === 0 ? `
                <div class="empty-statement">
                    لا توجد حركات مالية مسجلة لهذا الحساب حتى الآن.
                </div>
            ` : `
                <table class="statement-table">
                    <thead>
                        <tr>
                            <th style="width: 11%;">التاريخ</th>
                            <th style="width: 14%;">رقم المستند / الفاتورة</th>
                            <th style="width: 13%;">نوع الحركة</th>
                            <th style="width: 26%;">البيان والتفاصيل</th>
                            ${isFactory ? `
                                <th style="width: 12%;" class="th-green">إضافة رصيد (إيداع)</th>
                                <th style="width: 12%;" class="th-red">خصم مشتريات</th>
                            ` : `
                                <th style="width: 12%;" class="th-blue">قيمة الفاتورة (مشتريات)</th>
                                <th style="width: 12%;" class="th-green">المدفوع (سداد)</th>
                            `}
                            <th style="width: 12%;" class="th-balance">الرصيد بعد الحركة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            `}

            <div class="summary-section">
                <div class="summary-card-header">ملخص الحركة المالية والرصيد النهائي</div>
                <div class="summary-grid">
                    ${isFactory ? `
                        <div class="summary-box box-deposit">
                            <div class="summary-box-title">إجمالي الرصيد المضاف (إيداع)</div>
                            <div class="summary-box-value" dir="ltr">${totalPayments.toLocaleString()} ج.م</div>
                        </div>
                        <div class="summary-box box-purchase">
                            <div class="summary-box-title">إجمالي قيمة المشتريات</div>
                            <div class="summary-box-value" dir="ltr">${totalPurchases.toLocaleString()} ج.م</div>
                        </div>
                        <div class="summary-box box-tons">
                            <div class="summary-box-title">إجمالي الكميات المشتراة</div>
                            <div class="summary-box-value" dir="ltr">${Number(totalTons).toLocaleString(undefined, { maximumFractionDigits: 2 })} طن</div>
                        </div>
                        <div class="summary-box box-balance-final ${runningBalance >= 0 ? 'final-green' : 'final-red'}">
                            <div class="summary-box-title">الرصيد المتبقي بالمصنع</div>
                            <div class="summary-box-value" dir="ltr">${Math.abs(runningBalance).toLocaleString()} ج.م</div>
                            <div class="summary-box-sub">
                                ${runningBalance > 0 ? 'رصيد مسبق مدفوع لصالحنا عند المصنع' : (runningBalance < 0 ? 'مستحق السداد للمصنع' : 'الحساب متزن بالكامل')}
                            </div>
                        </div>
                    ` : `
                        <div class="summary-box box-purchase">
                            <div class="summary-box-title">إجمالي قيمة المشتريات</div>
                            <div class="summary-box-value" dir="ltr">${totalPurchases.toLocaleString()} ج.م</div>
                        </div>
                        <div class="summary-box box-payment">
                            <div class="summary-box-title">إجمالي المسدد للمورد</div>
                            <div class="summary-box-value" dir="ltr">${totalPayments.toLocaleString()} ج.م</div>
                        </div>
                        <div class="summary-box box-tons">
                            <div class="summary-box-title">إجمالي الكميات المشتراة</div>
                            <div class="summary-box-value" dir="ltr">${Number(totalTons).toLocaleString(undefined, { maximumFractionDigits: 2 })} طن</div>
                        </div>
                        <div class="summary-box box-balance-final ${runningBalance <= 0 ? 'final-green' : 'final-red'}">
                            <div class="summary-box-title">الرصيد النهائي للمورد</div>
                            <div class="summary-box-value" dir="ltr">${Math.abs(runningBalance).toLocaleString()} ج.م</div>
                            <div class="summary-box-sub">
                                ${runningBalance > 0 ? 'إجمالي المديونية المستحقة للمورد' : (runningBalance < 0 ? 'رصيد زايد مدفوع للمورد' : 'الحساب متزن بالكامل')}
                            </div>
                        </div>
                    `}
                </div>
            </div>
        </body>
        </html>
        `;

        const fs = require('fs');
        const getBrowserPath = () => {
            const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
            if (fs.existsSync(chromePath)) return chromePath;
            if (fs.existsSync(edgePath)) return edgePath;
            return undefined;
        };

        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ 
            headless: 'new',
            ...(getBrowserPath() ? { executablePath: getBrowserPath() } : {})
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '12mm', bottom: '18mm', left: '12mm' },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-family: 'Cairo', Arial, sans-serif; font-size: 8px; width: 100%; padding: 0 12mm; color: #64748b; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #cbd5e1; box-sizing: border-box; font-weight: 600;" dir="rtl">
                    <div><strong>الحندقوتي جروب للصناعة والتجارة</strong> | كشف حساب تفصيلي - ${supplier.name}</div>
                    <div>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></div>
                </div>
            `
        });
        await browser.close();

        res.setHeader('Content-disposition', `inline; filename="supplier_statement_${id}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        res.end(pdfBuffer);
    } catch (error) {
        if (!res.headersSent) { res.status(500).json({ error: error.message }); } else { console.error('PDF Error:', error.message); res.end(); }
    }
};


exports.downloadSupplierStatementExcel = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
        if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });

        // 1. Fetch Transactions
        let query = `
            SELECT sbt.id, sbt.supplier_id, sbt.created_at as transaction_date,
                   CASE WHEN sbt.transaction_type = 'purchase' THEN 'PURCHASE'
                        WHEN sbt.transaction_type = 'deposit' THEN 'PAYMENT'
                        ELSE 'OTHER' END as transaction_type,
                   sbt.reference_number as purchase_invoice_number,
                   sbt.description as notes,
                   sbt.amount,
                   p.id as actual_purchase_id
            FROM supplier_balance_transactions sbt
            LEFT JOIN purchases p ON p.supplier_id = sbt.supplier_id 
                 AND sbt.transaction_type = 'purchase' 
                 AND (p.invoice_number = sbt.reference_number OR CAST(p.id AS TEXT) = sbt.reference_number)
            WHERE sbt.supplier_id = ?
        `;
        const params = [id];
        if (startDate) { query += ' AND date(sbt.created_at) >= date(?)'; params.push(startDate); }
        if (endDate) { query += ' AND date(sbt.created_at) <= date(?)'; params.push(endDate); }
        query += ' ORDER BY sbt.created_at ASC, sbt.id ASC';
        
        const rawStatement = db.prepare(query).all(...params);
        let runningBalance = 0;
        const statement = rawStatement.map(t => {
            runningBalance += t.amount;
            return { ...t, balance_after: runningBalance };
        });

        // 2. Fetch Invoices and Items
        const invoices = db.prepare('SELECT * FROM purchases WHERE supplier_id = ? ORDER BY purchase_date ASC').all(id);
        const allItems = db.prepare(`
            SELECT pi.*, p.id as p_id, p.invoice_number, p.purchase_date
            FROM purchase_items pi 
            JOIN purchases p ON pi.purchase_id = p.id 
            WHERE p.supplier_id = ?
        `).all(id);

        const workbook = new ExcelJS.Workbook();
        
        // Sheet 1: Summary
        const s1 = workbook.addWorksheet('ملخص الحساب', { views: [{ rightToLeft: true }] });
        s1.columns = [{ header: 'البيان', key: 'k', width: 30 }, { header: 'القيمة', key: 'v', width: 30 }];
        s1.getRow(1).font = { bold: true };
        s1.addRow({ k: 'الاسم', v: supplier.name });
        s1.addRow({ k: 'النوع', v: supplier.type });
        s1.addRow({ k: 'رقم الهاتف', v: supplier.phone || '-' });
        s1.addRow({ k: 'تاريخ التقرير', v: new Date().toLocaleDateString('en-GB') });
        s1.addRow({ k: 'الرصيد الحالي', v: supplier.balance });
        
        // Sheet 2: Transactions
        const s2 = workbook.addWorksheet('حركة الحساب', { views: [{ rightToLeft: true }] });
        s2.columns = [
            { header: 'التاريخ', key: 'date', width: 15 },
            { header: 'نوع الحركة', key: 'type', width: 20 },
            { header: 'رقم الفاتورة/البيان', key: 'ref', width: 30 },
            { header: 'مدين/مشتريات', key: 'credit', width: 15 },
            { header: 'دائن/مدفوع', key: 'debit', width: 15 },
            { header: 'الرصيد', key: 'bal', width: 15 }
        ];
        s2.getRow(1).font = { bold: true };
        statement.forEach(t => {
            s2.addRow({
                date: new Date(t.transaction_date).toLocaleDateString('en-GB'),
                type: t.transaction_type === 'PURCHASE' ? 'فاتورة مشتريات' : (supplier.type === 'مصنع' ? 'إيداع' : 'سداد'),
                ref: t.purchase_invoice_number ? `فاتورة #${t.purchase_invoice_number}` : (t.notes || '-'),
                credit: t.amount > 0 ? t.amount : 0,
                debit: t.amount < 0 ? Math.abs(t.amount) : 0,
                bal: t.balance_after
            });
        });

        // Sheet 3: Purchase Invoices
        const s3 = workbook.addWorksheet('فواتير المشتريات', { views: [{ rightToLeft: true }] });
        s3.columns = [
            { header: 'رقم الفاتورة', key: 'inv', width: 15 },
            { header: 'التاريخ', key: 'date', width: 15 },
            { header: 'الإجمالي', key: 'tot', width: 15 },
            { header: 'المدفوع', key: 'paid', width: 15 },
            { header: 'المتبقي', key: 'rem', width: 15 }
        ];
        s3.getRow(1).font = { bold: true };
        invoices.forEach(inv => {
            s3.addRow({
                inv: inv.invoice_number || inv.id,
                date: new Date(inv.purchase_date).toLocaleDateString('en-GB'),
                tot: inv.total_amount,
                paid: inv.paid_amount,
                rem: inv.remaining_amount
            });
        });

        // Sheet 4: Invoice Items
        const s4 = workbook.addWorksheet('تفاصيل الأصناف', { views: [{ rightToLeft: true }] });
        s4.columns = [
            { header: 'رقم الفاتورة', key: 'inv', width: 15 },
            { header: 'تاريخ الفاتورة', key: 'date', width: 15 },
            { header: 'الصنف', key: 'item', width: 30 },
            { header: 'الكمية', key: 'qty', width: 10 },
            { header: 'الوحدة', key: 'unit', width: 15 },
            { header: 'السعر', key: 'price', width: 15 },
            { header: 'الإجمالي', key: 'tot', width: 15 }
        ];
        s4.getRow(1).font = { bold: true };
        allItems.forEach(item => {
            s4.addRow({
                inv: item.invoice_number || item.p_id,
                date: new Date(item.purchase_date).toLocaleDateString('en-GB'),
                item: item.item_name,
                qty: item.quantity,
                unit: item.unit,
                price: item.unit_price,
                tot: item.total_price
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=supplier_statement_${id}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateSupplierTransaction = (req, res) => {
    const transactionId = req.params.id;
    const { amount, reference_number, description, created_at } = req.body;

    try {
        const transaction = db.transaction(() => {
            const oldTx = db.prepare('SELECT * FROM supplier_balance_transactions WHERE id = ?').get(transactionId);
            if (!oldTx) throw new Error('الحركة المالية غير موجودة');

            const supplier = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(oldTx.supplier_id);
            if (!supplier) throw new Error('المورد غير موجود');

            const newAmount = Number(amount);
            if (isNaN(newAmount)) throw new Error('المبلغ غير صحيح');

            const diff = newAmount - oldTx.amount;

            db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(diff, oldTx.supplier_id);

            db.prepare(`
                UPDATE supplier_balance_transactions 
                SET amount = ?, reference_number = ?, description = ?, created_at = COALESCE(?, created_at)
                WHERE id = ?
            `).run(newAmount, reference_number || oldTx.reference_number, description || oldTx.description, created_at || oldTx.created_at, transactionId);

            return { success: true };
        });

        transaction();
        res.json({ message: 'تم تعديل الحركة المالية وتحديث رصيد الحساب بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
