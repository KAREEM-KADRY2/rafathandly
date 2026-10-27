const db = require('../db');
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

exports.getDailySummary = (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Base date filter
        let dateCondition = "1=1";
        const params = [];
        if (startDate) {
            dateCondition += " AND DATE(t.date_col) >= DATE(?)";
            params.push(startDate);
        }
        if (endDate) {
            dateCondition += " AND DATE(t.date_col) <= DATE(?)";
            params.push(endDate);
        }

        const buildQuery = (table, dateColumn, sumColumn, additionalCondition = "1=1") => `
            SELECT COALESCE(SUM(${sumColumn}), 0) as total
            FROM (SELECT ${dateColumn} as date_col, ${sumColumn} FROM ${table} WHERE ${additionalCondition}) t
            WHERE ${dateCondition}
        `;

        // Sales (credit_sales)
        const totalSales = db.prepare(buildQuery('credit_sales', 'sale_date', 'original_amount')).get(...params).total;
        
        // Purchases (purchases)
        const totalPurchases = db.prepare(buildQuery('purchases', 'purchase_date', 'total_amount')).get(...params).total;

        // Customer Collections (Money IN)
        const customerCollections = db.prepare(buildQuery('customer_payments', 'payment_date', 'amount')).get(...params).total;
        
        // Freight Collections (Money IN)
        const freightCollections = db.prepare(buildQuery('freight_transactions', 'collection_date', 'amount')).get(...params).total;
        
        const totalCollections = customerCollections + freightCollections;

        // Supplier Payments (Money OUT)
        const supplierPayments = db.prepare(buildQuery('supplier_balance_transactions', 'created_at', 'amount', "transaction_type = 'deposit'")).get(...params).total;
        
        // Vehicle Expenses (Money OUT)
        const vehicleExpenses = db.prepare(buildQuery('expenses', 'expense_date', 'amount', "status = 'active'")).get(...params).total;
        
        // Worker Withdrawals (Money OUT)
        const workerWithdrawals = db.prepare(buildQuery('worker_withdrawals', 'withdrawal_date', 'amount', "status = 'active'")).get(...params).total;
        
        // Other Expenses (Money OUT)
        const otherExpenses = db.prepare(buildQuery('other_expenses', 'expense_date', 'amount', "status = 'active'")).get(...params).total;
        
        const totalZara = db.prepare(buildQuery('customer_adjustments', 'adjustment_date', 'amount', "type = 'ZARA'")).get(...params).total;
        const totalExpenses = vehicleExpenses + workerWithdrawals + otherExpenses;
        const totalPayments = supplierPayments + totalExpenses;

        // Outstanding at customers (Current, ignores date filter because it's a running balance)
        const totalCustomerOB = db.prepare(`SELECT COALESCE(SUM(CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END), 0) as total FROM opening_balances WHERE entity_type = 'customer'`).get().total;
        const allTimeSales = db.prepare(`SELECT COALESCE(SUM(original_amount), 0) as total FROM credit_sales WHERE status != 'CANCELLED'`).get().total;
        const totalCustPayments = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments`).get().total;
        const totalCustAdj = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM customer_adjustments`).get().total;
        const totalOutstandingCustomers = totalCustomerOB + allTimeSales - totalCustPayments - totalCustAdj;

        // Net Cash Movement
        const netCash = totalCollections - totalPayments;

        res.json({
            totalSales,
            totalPurchases,
            totalCollections,
            totalPayments,
            totalExpenses,
            totalZara,
            totalOutstandingCustomers,
            netCash,
            details: {
                customerCollections,
                freightCollections,
                supplierPayments,
                vehicleExpenses,
                workerWithdrawals,
                otherExpenses
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء استخراج التقرير' });
    }
};

exports.getMoneyIn = (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let params = [];
        let dateConditionCP = "1=1";
        let dateConditionFT = "1=1";
        
        if (startDate) {
            dateConditionCP += " AND DATE(cp.payment_date) >= DATE(?)";
            dateConditionFT += " AND DATE(ft.collection_date) >= DATE(?)";
            params.push(startDate, startDate);
        }
        if (endDate) {
            dateConditionCP += " AND DATE(cp.payment_date) <= DATE(?)";
            dateConditionFT += " AND DATE(ft.collection_date) <= DATE(?)";
            params.push(endDate, endDate);
        }

        const query = `
            SELECT 'تحصيل من عميل' as type, c.name as party, cp.amount, cp.payment_date as date, cp.payment_method as method, cp.reference_number as doc, cp.notes
            FROM customer_payments cp
            JOIN customers c ON cp.customer_id = c.id
            WHERE ${dateConditionCP}
            UNION ALL
            SELECT 'تحصيل نولون' as type, s.name as party, ft.amount, ft.collection_date as date, ft.payment_method as method, ft.reference_number as doc, ft.notes
            FROM freight_transactions ft
            JOIN suppliers s ON ft.supplier_id = s.id
            WHERE ${dateConditionFT}
            ORDER BY date DESC
        `;
        
        // params need to be passed correctly for UNION ALL (startDate, startDate, endDate, endDate)
        // Re-construct params for the union query correctly
        let finalParams = [];
        if (startDate && endDate) finalParams = [startDate, endDate, startDate, endDate];
        else if (startDate) finalParams = [startDate, startDate];
        else if (endDate) finalParams = [endDate, endDate];

        const results = db.prepare(query).all(...finalParams);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ' });
    }
};

exports.getMoneyOut = (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let finalParams = [];
        let cond1="1=1", cond2="1=1", cond3="1=1", cond4="1=1";
        if (startDate && endDate) {
            cond1 = "DATE(t.created_at) >= DATE(?) AND DATE(t.created_at) <= DATE(?)";
            cond2 = "DATE(expense_date) >= DATE(?) AND DATE(expense_date) <= DATE(?)";
            cond3 = "DATE(withdrawal_date) >= DATE(?) AND DATE(withdrawal_date) <= DATE(?)";
            cond4 = "DATE(expense_date) >= DATE(?) AND DATE(expense_date) <= DATE(?)";
            finalParams = [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate];
        } else if (startDate) {
            cond1 = "DATE(t.created_at) >= DATE(?)";
            cond2 = "DATE(expense_date) >= DATE(?)";
            cond3 = "DATE(withdrawal_date) >= DATE(?)";
            cond4 = "DATE(expense_date) >= DATE(?)";
            finalParams = [startDate, startDate, startDate, startDate];
        } else if (endDate) {
            cond1 = "DATE(t.created_at) <= DATE(?)";
            cond2 = "DATE(expense_date) <= DATE(?)";
            cond3 = "DATE(withdrawal_date) <= DATE(?)";
            cond4 = "DATE(expense_date) <= DATE(?)";
            finalParams = [endDate, endDate, endDate, endDate];
        }

        const query = `
            SELECT 'دفعة مورد' as type, s.name as party, t.amount, t.created_at as date, t.reference_number as doc, t.description as notes
            FROM supplier_balance_transactions t
            JOIN suppliers s ON t.supplier_id = s.id
            WHERE t.transaction_type = 'deposit' AND ${cond1}
            
            UNION ALL
            
            SELECT 'مصروفات مركبات' as type, vehicle as party, amount, expense_date as date, document_number as doc, description as notes
            FROM expenses
            WHERE status = 'active' AND ${cond2}
            
            UNION ALL
            
            SELECT 'مسحوبات عمال' as type, w.name as party, t.amount, t.withdrawal_date as date, t.document_number as doc, t.description as notes
            FROM worker_withdrawals t
            JOIN workers w ON t.worker_id = w.id
            WHERE t.status = 'active' AND ${cond3}
            
            UNION ALL
            
            SELECT 'مصروفات أخرى' as type, expense_name as party, amount, expense_date as date, document_number as doc, description as notes
            FROM other_expenses
            WHERE status = 'active' AND ${cond4}
            
            ORDER BY date DESC
        `;
        
        const results = db.prepare(query).all(...finalParams);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ' });
    }
};

exports.getCustomersOutstanding = (req, res) => {
    try {
        const query = `
            SELECT 
                c.id, c.name, c.phone,
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id), 0) as opening_balance,
                COALESCE(SUM(s.original_amount), 0) as total_credit_sales,
                COALESCE((SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) FROM customer_payments WHERE customer_id = c.id), 0) as total_paid,
                COALESCE(SUM(s.zara_amount), 0) as total_zara,
                (
                    COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id), 0) +
                    COALESCE(SUM(s.original_amount), 0) -
                    COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) -
                    COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = c.id), 0)
                ) as total_outstanding,
                MIN(CASE WHEN s.remaining_amount > 0 THEN s.due_date END) as nearest_due_date,
                SUM(CASE WHEN s.remaining_amount > 0 AND DATE(s.due_date) < DATE('now') THEN 1 ELSE 0 END) as overdue_sales_count,
                COALESCE(SUM(CASE WHEN s.remaining_amount > 0 AND DATE(s.due_date) < DATE('now') THEN s.remaining_amount ELSE 0 END), 0) as overdue_amount
            FROM customers c
            LEFT JOIN credit_sales s ON c.id = s.customer_id AND s.status != 'CANCELLED'
            WHERE c.status = 'active'
            GROUP BY c.id
            HAVING total_outstanding > 0
            ORDER BY total_outstanding DESC
        `;
        
        const customers = db.prepare(query).all();
        res.json(customers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ' });
    }
};

exports.getZaraDetails = (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = `
            SELECT a.id, a.adjustment_date, a.amount, a.reason as notes, c.id as customer_id, c.name as customer_name
            FROM customer_adjustments a
            JOIN customers c ON a.customer_id = c.id
            WHERE a.type = 'ZARA'
        `;
        const params = [];
        if (startDate) {
            query += " AND DATE(a.adjustment_date) >= DATE(?)";
            params.push(startDate);
        }
        if (endDate) {
            query += " AND DATE(a.adjustment_date) <= DATE(?)";
            params.push(endDate);
        }
        query += " ORDER BY a.adjustment_date DESC";
        
        const details = db.prepare(query).all(...params);
        res.json(details);
    } catch (error) {
        if (!res.headersSent) { res.status(500).json({ error: error.message }); } else { console.error('PDF Error:', error.message); res.end(); }
    }
};

exports.downloadOverduePDF = async (req, res) => {
    try {
        const overdueSales = db.prepare(`
            SELECT s.id, s.invoice_number, c.name as customer_name, c.phone,
                   s.original_amount, s.paid_amount, s.remaining_amount, s.due_date,
                   CAST(julianday('now', '+3 hours') - julianday(s.due_date) AS INTEGER) as overdue_days
            FROM credit_sales s 
            JOIN customers c ON s.customer_id = c.id 
            WHERE s.remaining_amount > 0 
              AND date(s.due_date) <= date('now', '+3 days') 
              AND s.status != 'CANCELLED'
            ORDER BY s.due_date ASC
        `).all();

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { margin: 0; color: #1e3a8a; }
                .header h2 { margin: 5px 0 15px 0; color: #475569; font-size: 18px; }
                .date { text-align: center; color: #64748b; font-size: 14px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th { background-color: #f1f5f9; color: #334155; font-weight: bold; padding: 10px; border: 1px solid #cbd5e1; text-align: right; }
                td { padding: 10px; border: 1px solid #cbd5e1; text-align: right; }
                .overdue { color: #dc2626; font-weight: bold; }
                .soon { color: #d97706; font-weight: bold; }
                .empty { text-align: center; padding: 30px; color: #64748b; font-size: 16px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>الحندقوتي جروب</h1>
                <h2>تقرير تنبيهات الفواتير المتأخرة والقريبة</h2>
            </div>
            <div class="date">تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' })}</div>
            
            ${overdueSales.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>العميل</th>
                        <th>الهاتف</th>
                        <th>الفاتورة</th>
                        <th>إجمالي الفاتورة</th>
                        <th>المدفوع</th>
                        <th>المتبقي</th>
                        <th>الاستحقاق</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${overdueSales.map(s => `
                    <tr>
                        <td>${s.customer_name}</td>
                        <td dir="ltr" style="text-align: right;">${s.phone || '-'}</td>
                        <td>#${s.invoice_number || s.id}</td>
                        <td>${s.original_amount}</td>
                        <td>${s.paid_amount}</td>
                        <td style="font-weight: bold;">${s.remaining_amount}</td>
                        <td dir="ltr" style="text-align: right;">${s.due_date}</td>
                        <td class="${s.overdue_days > 0 ? 'overdue' : 'soon'}">
                            ${s.overdue_days > 0 ? `متأخر ${s.overdue_days} يوم` : 'تستحق قريباً'}
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<div class="empty">لا توجد تنبيهات حالياً.</div>'}
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
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });
        await browser.close();

        res.setHeader('Content-disposition', `attachment; filename=alerts.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        res.end(pdfBuffer);
    } catch (error) {
        if (!res.headersSent) { res.status(500).json({ error: error.message }); } else { console.error('PDF Error:', error.message); res.end(); }
    }
};

exports.downloadOverdueExcel = async (req, res) => {
    try {
        const overdueSales = db.prepare(`
            SELECT s.id, s.invoice_number, c.name as customer_name, c.phone, s.sale_date,
                   s.original_amount, s.paid_amount, s.remaining_amount, s.due_date,
                   CAST(julianday('now', '+3 hours') - julianday(s.due_date) AS INTEGER) as overdue_days
            FROM credit_sales s 
            JOIN customers c ON s.customer_id = c.id 
            WHERE s.remaining_amount > 0 
              AND date(s.due_date) <= date('now', '+3 days') 
              AND s.status != 'CANCELLED'
            ORDER BY s.due_date ASC
        `).all();

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('المتأخرين عن السداد', { views: [{ rightToLeft: true }] });
        
        sheet.columns = [
            { header: 'العميل', key: 'customer_name', width: 25 },
            { header: 'الهاتف', key: 'phone', width: 15 },
            { header: 'رقم الفاتورة', key: 'invoice_number', width: 15 },
            { header: 'تاريخ الفاتورة', key: 'sale_date', width: 15 },
            { header: 'إجمالي الفاتورة', key: 'original_amount', width: 15 },
            { header: 'المدفوع', key: 'paid_amount', width: 15 },
            { header: 'المتبقي', key: 'remaining_amount', width: 15 },
            { header: 'تاريخ الاستحقاق', key: 'due_date', width: 15 },
            { header: 'أيام التأخير', key: 'overdue_days', width: 15 },
            { header: 'الحالة', key: 'status', width: 15 }
        ];

        sheet.getRow(1).font = { name: 'Arial', bold: true, size: 12 };
        sheet.getRow(1).alignment = { horizontal: 'center' };

        overdueSales.forEach(s => {
            const row = sheet.addRow({
                customer_name: s.customer_name,
                phone: s.phone || '-',
                invoice_number: '#' + (s.invoice_number || s.id),
                sale_date: s.sale_date,
                original_amount: s.original_amount,
                paid_amount: s.paid_amount,
                remaining_amount: s.remaining_amount,
                due_date: s.due_date,
                overdue_days: s.overdue_days > 0 ? s.overdue_days : 0,
                status: s.overdue_days > 0 ? 'متأخر' : 'تستحق قريباً'
            });
            row.font = { name: 'Arial', size: 11 };
            row.alignment = { horizontal: 'center' };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=overdue_customers.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        if (!res.headersSent) { res.status(500).json({ error: error.message }); } else { console.error('PDF Error:', error.message); res.end(); }
    }
};
