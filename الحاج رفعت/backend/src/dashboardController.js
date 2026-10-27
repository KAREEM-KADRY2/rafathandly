const db = require('../db');

exports.getDashboardSummary = (req, res) => {
    try {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

        // 1. Today's Summary
        const todaySales = db.prepare(`SELECT COALESCE(SUM(original_amount), 0) as total FROM credit_sales WHERE date(sale_date) = ? AND status != 'CANCELLED'`).get(today).total;
        const todayCollections = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE date(payment_date) = ?`).get(today).total;
        const todayPurchases = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE date(purchase_date) = ?`).get(today).total;
        // Supplier payments are stored as negative amounts in supplier_balance_transactions (transaction_type='purchase' or 'deposit')
        const todaySupplierPayments = db.prepare(`SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM supplier_balance_transactions WHERE date(created_at) = ? AND transaction_type = 'deposit'`).get(today).total;

        const todayExpenses1 = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(expense_date) = ? AND status != 'CANCELLED'`).get(today).total;
        const todayExpenses2 = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM other_expenses WHERE date(expense_date) = ? AND status != 'CANCELLED'`).get(today).total;
        const todayWithdrawals = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM worker_withdrawals WHERE date(withdrawal_date) = ? AND status != 'CANCELLED'`).get(today).total;
        const todayTotalExpenses = todayExpenses1 + todayExpenses2 + todayWithdrawals;

        const netCashMovement = todayCollections - todaySupplierPayments - todayTotalExpenses;

        const todaySummary = {
            sales: todaySales,
            collections: todayCollections,
            purchases: todayPurchases,
            supplierPayments: todaySupplierPayments,
            expenses: todayTotalExpenses,
            netCash: netCashMovement,
            netCashMovement: netCashMovement
        };

        // 2. Treasury (calculated from all historical data)
        const totalCollections = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments`).get().total;
        const totalSupplierPayments = db.prepare(`SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM supplier_balance_transactions WHERE transaction_type = 'deposit'`).get().total;
        const totalExp1 = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status != 'CANCELLED'`).get().total;
        const totalExp2 = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM other_expenses WHERE status != 'CANCELLED'`).get().total;
        const totalWith = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM worker_withdrawals WHERE status != 'CANCELLED'`).get().total;

        const overallCash = totalCollections - (totalSupplierPayments + totalExp1 + totalExp2 + totalWith);

        const treasury = {
            cash: overallCash,
            bankMisr: 0,
            nbe: 0,
            wallets: 0,
            total: overallCash
        };

        // 3. Alerts
        const alerts = [];

        // Overdue Customers
        const overdueSales = db.prepare(`
            SELECT s.id, s.invoice_number, c.name, c.id as customer_id, s.remaining_amount, s.due_date,
                   CAST(julianday('now', '+3 hours') - julianday(s.due_date) AS INTEGER) as overdue_days
            FROM credit_sales s 
            JOIN customers c ON s.customer_id = c.id 
            WHERE s.remaining_amount > 0 AND date('now', '+3 hours') > date(s.due_date) AND s.status != 'CANCELLED'
        `).all();
        overdueSales.forEach(sale => {
            alerts.push({
                type: 'overdue_customer',
                title: 'متأخر عن السداد',
                customerName: sale.name,
                invoiceNumber: sale.invoice_number || sale.id,
                remainingAmount: sale.remaining_amount,
                dueDate: sale.due_date,
                overdueDays: sale.overdue_days,
                link: `/customers/${sale.customer_id}`
            });
        });

        // Invoices Due Soon (within next 3 days)
        const dueSoonSales = db.prepare(`
            SELECT s.id, s.invoice_number, c.name, c.id as customer_id, s.remaining_amount, s.due_date 
            FROM credit_sales s 
            JOIN customers c ON s.customer_id = c.id 
            WHERE s.remaining_amount > 0 AND date(s.due_date) BETWEEN date('now', '+3 hours') AND date('now', '+3 days') AND s.status != 'CANCELLED'
        `).all();
        dueSoonSales.forEach(sale => {
            alerts.push({
                type: 'due_soon',
                title: 'مستحقات قريبة',
                customerName: sale.name,
                invoiceNumber: sale.invoice_number || sale.id,
                remainingAmount: sale.remaining_amount,
                dueDate: sale.due_date,
                link: `/customers/${sale.customer_id}`
            });
        });

        // Low Stock
        const items = db.prepare(`
            SELECT i.id, i.name, i.min_stock,
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = i.id AND movement_type IN ('IN', 'ADJUST_IN')), 0) -
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = i.id AND movement_type IN ('OUT', 'ADJUST_OUT')), 0) as current_stock
            FROM inventory_items i
        `).all();

        items.forEach(item => {
            if (item.current_stock <= 0) {
                alerts.push({
                    type: 'out_of_stock',
                    title: 'نفد المخزون',
                    message: `الصنف ${item.name} نفد من المخزن تماماً`,
                    link: `/warehouse/${item.id}`
                });
            } else if (item.current_stock <= item.min_stock) {
                alerts.push({
                    type: 'low_stock',
                    title: 'مخزون منخفض',
                    message: `الصنف ${item.name} وصل للحد الأدنى (${item.current_stock})`,
                    link: `/warehouse/${item.id}`
                });
            }
        });

        // 4. Recent Operations (Limit to 15)
        let operations = [];

        const recentSales = db.prepare(`SELECT id, sale_date as date, 'بيع' as type, 'فاتورة بيع رقم ' || COALESCE(invoice_number, id) as description, original_amount as amount, status FROM credit_sales ORDER BY created_at DESC LIMIT 10`).all();
        const recentPayments = db.prepare(`SELECT id, payment_date as date, 'تحصيل' as type, 'تحصيل من عميل' as description, amount, 'مكتمل' as status FROM customer_payments ORDER BY created_at DESC LIMIT 10`).all();
        const recentPurchases = db.prepare(`SELECT id, purchase_date as date, 'شراء' as type, 'فاتورة شراء رقم ' || COALESCE(invoice_number, id) as description, total_amount as amount, 'مكتمل' as status FROM purchases ORDER BY created_at DESC LIMIT 10`).all();
        const recentSupplierPayments = db.prepare(`SELECT id, created_at as date, 'دفع مورد' as type, COALESCE(description, 'سداد دفعة لمورد') as description, ABS(amount) as amount, 'مكتمل' as status FROM supplier_balance_transactions WHERE transaction_type = 'deposit' ORDER BY created_at DESC LIMIT 10`).all();
        const recentExpenses = db.prepare(`SELECT id, expense_date as date, 'مصروف' as type, expense_type || ' - ' || vehicle as description, amount, status FROM expenses ORDER BY created_at DESC LIMIT 10`).all();

        operations = [...recentSales, ...recentPayments, ...recentPurchases, ...recentSupplierPayments, ...recentExpenses];

        // Sort by date descending
        operations.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Keep top 15
        operations = operations.slice(0, 15);

        res.json({
            todaySummary,
            treasury,
            alerts,
            recentOperations: operations
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

