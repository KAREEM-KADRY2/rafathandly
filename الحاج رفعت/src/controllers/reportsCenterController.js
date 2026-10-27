const db = require('../db');

// Helper to handle date filtering
const getDateFilter = (startDate, endDate, dateColumn) => {
    let filter = "";
    let params = [];
    if (startDate) {
        filter += ` AND date(${dateColumn}) >= date(?)`;
        params.push(startDate);
    }
    if (endDate) {
        filter += ` AND date(${dateColumn}) <= date(?)`;
        params.push(endDate);
    }
    return { filter, params };
};

exports.getSalesReport = (req, res) => {
    const { startDate, endDate } = req.query;
    const { filter, params } = getDateFilter(startDate, endDate, 'sale_date');

    try {
        const sales = db.prepare(`
            SELECT s.*, c.name as customer_name 
            FROM credit_sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.status != 'CANCELLED' ${filter}
            ORDER BY s.sale_date DESC
        `).all(...params);

        const summary = db.prepare(`
            SELECT 
                COUNT(*) as count,
                COUNT(DISTINCT customer_id) as customers_count,
                SUM(original_amount) as total_sales,
                SUM(paid_amount) as total_paid,
                SUM(remaining_amount) as total_remaining
            FROM credit_sales
            WHERE status != 'CANCELLED' ${filter}
        `).get(...params);

        res.json({ sales, summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPurchasesReport = (req, res) => {
    const { startDate, endDate } = req.query;
    const { filter, params } = getDateFilter(startDate, endDate, 'purchase_date');

    try {
        const purchases = db.prepare(`
            SELECT p.*, s.name as supplier_name, fa.name as account_name 
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN financial_accounts fa ON p.account_id = fa.id
            WHERE p.status != 'CANCELLED' ${filter}
            ORDER BY p.purchase_date DESC
        `).all(...params);

        const summary = db.prepare(`
            SELECT 
                COUNT(*) as count,
                COUNT(DISTINCT supplier_id) as suppliers_count,
                SUM(total_amount) as total_purchases,
                SUM(paid_amount) as total_paid,
                SUM(remaining_amount) as total_remaining,
                SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END) as total_cash_purchases,
                SUM(CASE WHEN payment_type != 'cash' THEN total_amount ELSE 0 END) as total_credit_purchases
            FROM purchases
            WHERE status != 'CANCELLED' ${filter}
        `).get(...params);

        res.json({ purchases, summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCustomersReport = (req, res) => {
    try {
        const customers = db.prepare(`
            SELECT 
                c.id, c.name,
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id), 0) as opening_balance,
                COALESCE(SUM(s.original_amount), 0) as total_sales,
                COALESCE((SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) FROM customer_payments WHERE customer_id = c.id), 0) as total_paid,
                (
                    COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id), 0) +
                    COALESCE(SUM(s.original_amount), 0) -
                    COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) -
                    COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = c.id), 0)
                ) as total_remaining,
                COALESCE(SUM(CASE WHEN s.due_date < date('now') THEN s.remaining_amount ELSE 0 END), 0) as total_overdue,
                COUNT(s.id) as sales_count,
                MAX(s.sale_date) as last_sale_date,
                MIN(CASE WHEN s.remaining_amount > 0 THEN s.due_date ELSE NULL END) as nearest_due_date
            FROM customers c
            LEFT JOIN credit_sales s ON c.id = s.customer_id AND s.status != 'CANCELLED'
            GROUP BY c.id
            ORDER BY total_remaining DESC
        `).all();

        res.json({ customers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSingleCustomerReport = (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const { filter, params } = getDateFilter(startDate, endDate, 'transaction_date');

    try {
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const transactions = db.prepare(`
            SELECT * FROM customer_account_transactions 
            WHERE customer_id = ? ${filter}
            ORDER BY transaction_date DESC, id DESC
        `).all(id, ...params);

        const summary = db.prepare(`
            SELECT 
                SUM(CASE WHEN transaction_type = 'SALE' THEN amount ELSE 0 END) as total_sales,
                SUM(CASE WHEN transaction_type = 'PAYMENT' AND amount < 0 THEN ABS(amount) ELSE 0 END) as total_paid,
                SUM(CASE WHEN (transaction_type = 'PAYMENT' AND amount > 0) OR transaction_type = 'DISBURSEMENT' THEN amount ELSE 0 END) as total_disbursed,
                SUM(CASE WHEN transaction_type = 'ZARA' THEN ABS(amount) ELSE 0 END) as total_zara,
                SUM(CASE WHEN transaction_type = 'OPENING_BALANCE' THEN amount ELSE 0 END) as opening_balance
            FROM customer_account_transactions
            WHERE customer_id = ? ${filter}
        `).get(id, ...params);
        
        // Current actual remaining (including opening balance)
        const obRow = db.prepare("SELECT balance_type, amount FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?").get(id);
        const openingBalance = obRow ? (obRow.balance_type === 'debit' ? obRow.amount : -obRow.amount) : 0;
        const currentSales = db.prepare(`
            SELECT 
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) +
                COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = ?), 0)
            AS remaining
        `).get(id, id, id, id);
        const currentBalance = currentSales ? currentSales.remaining : 0;

        res.json({ customer, transactions, summary, currentBalance, openingBalance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getProfitLossReport = (req, res) => {
    const { startDate, endDate } = req.query;
    const { filter: salesFilter, params: salesParams } = getDateFilter(startDate, endDate, 'sale_date');
    const { filter: expensesFilter, params: expensesParams } = getDateFilter(startDate, endDate, 'expense_date');
    const { filter: otherExpensesFilter, params: otherExpensesParams } = getDateFilter(startDate, endDate, 'expense_date');

    try {
        // Sales Revenue
        const sales = db.prepare(`
            SELECT SUM(original_amount) as revenue 
            FROM credit_sales 
            WHERE status != 'CANCELLED' ${salesFilter}
        `).get(...salesParams);

        // COGS (Cost of Goods Sold)
        // Fetch items from sales, and match them with inventory average cost (or just unit_price from purchase if tracking is direct, but usually we just calculate it)
        const cogsQuery = db.prepare(`
            SELECT SUM(si.quantity * COALESCE((
                SELECT AVG(unit_price) FROM purchase_items pi WHERE pi.item_name = si.item_name
            ), 0)) as cogs
            FROM credit_sale_items si
            JOIN credit_sales s ON si.credit_sale_id = s.id
            WHERE s.status != 'CANCELLED' ${salesFilter.replace(/sale_date/g, 's.sale_date')}
        `).get(...salesParams);

        // Operating Expenses
        const expenses = db.prepare(`
            SELECT SUM(amount) as total_expenses,
                   SUM(CASE WHEN expense_type = 'O U,OO O' THEN amount ELSE 0 END) as fuel,
                   SUM(CASE WHEN expense_type = 'O U,OUSO U+Oc' THEN amount ELSE 0 END) as maintenance,
                   SUM(CASE WHEN expense_type = 'OUOO U.USOc' THEN amount ELSE 0 END) as gratuity
            FROM expenses WHERE status = 'active' ${expensesFilter}
        `).get(...expensesParams);

        const otherExpenses = db.prepare(`
            SELECT SUM(amount) as total_other FROM other_expenses WHERE status = 'active' ${otherExpensesFilter}
        `).get(...otherExpensesParams);

        // Worker withdrawals treated as expenses
        const { filter: workersFilter, params: workersParams } = getDateFilter(startDate, endDate, 'withdrawal_date');
        const workers = db.prepare(`
            SELECT SUM(amount) as total_workers FROM worker_withdrawals WHERE status = 'active' ${workersFilter}
        `).get(...workersParams);

        const revenue = sales.revenue || 0;
        const cogs = cogsQuery.cogs || 0;
        const grossProfit = revenue - cogs;
        
        const operatingExpenses = (expenses.total_expenses || 0) + (otherExpenses.total_other || 0) + (workers.total_workers || 0);
        
        const netProfit = grossProfit - operatingExpenses;

        res.json({
            revenue,
            cogs,
            grossProfit,
            operatingExpenses,
            expensesBreakdown: {
                fuel: expenses.fuel || 0,
                maintenance: expenses.maintenance || 0,
                gratuity: expenses.gratuity || 0,
                other: otherExpenses.total_other || 0,
                workers: workers.total_workers || 0
            },
            netProfit
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getProductsReport = (req, res) => {
    const { startDate, endDate } = req.query;
    // For products, usually we want current stock, but also sales during period
    const { filter: salesFilter, params: salesParams } = getDateFilter(startDate, endDate, 's.sale_date');
    const { filter: purchaseFilter, params: purchaseParams } = getDateFilter(startDate, endDate, 'p.purchase_date');

    try {
        const products = db.prepare(`
            SELECT 
                i.id, i.name as item_name,
                COALESCE((
                    SELECT SUM(quantity) FROM inventory_movements 
                    WHERE item_id = i.id AND movement_type IN ('IN', 'ADJUST_IN')
                ), 0) - COALESCE((
                    SELECT SUM(quantity) FROM inventory_movements 
                    WHERE item_id = i.id AND movement_type IN ('OUT', 'ADJUST_OUT')
                ), 0) as current_stock,
                (
                    SELECT SUM(si.quantity) FROM credit_sale_items si
                    JOIN credit_sales s ON si.credit_sale_id = s.id
                    WHERE si.item_name = i.name AND s.status != 'CANCELLED' ${salesFilter}
                ) as qty_sold,
                (
                    SELECT SUM(si.total_price) FROM credit_sale_items si
                    JOIN credit_sales s ON si.credit_sale_id = s.id
                    WHERE si.item_name = i.name AND s.status != 'CANCELLED' ${salesFilter}
                ) as sales_revenue,
                (
                    SELECT SUM(pi.quantity) FROM purchase_items pi
                    JOIN purchases p ON pi.purchase_id = p.id
                    WHERE pi.item_name = i.name AND p.status != 'CANCELLED' ${purchaseFilter}
                ) as qty_purchased
            FROM inventory_items i
        `).all(...salesParams, ...purchaseParams);

        res.json({ products });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSingleProductReport = (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const { filter, params } = getDateFilter(startDate, endDate, 'movement_date');

    try {
        const product = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const movements = db.prepare(`
            SELECT m.*, 
                   s.name as supplier_name,
                   c.name as customer_name
            FROM inventory_movements m
            LEFT JOIN suppliers s ON m.supplier_id = s.id
            LEFT JOIN customers c ON m.customer_id = c.id
            WHERE m.item_id = ? ${filter}
            ORDER BY m.movement_date DESC, m.id DESC
        `).all(id, ...params);

        res.json({ product, movements });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCollectionsReport = (req, res) => {
    const { startDate, endDate } = req.query;
    const { filter, params } = getDateFilter(startDate, endDate, 'p.payment_date');

    try {
        const collections = db.prepare(`
            SELECT p.*, c.name as customer_name, s.invoice_number
            FROM customer_payments p
            JOIN customers c ON p.customer_id = c.id
            LEFT JOIN credit_sales s ON p.credit_sale_id = s.id
            WHERE p.amount > 0 ${filter}
            ORDER BY p.payment_date DESC
        `).all(...params);

        const summary = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_collections
            FROM customer_payments p
            WHERE p.amount > 0 ${filter}
        `).get(...params);

        res.json({ collections, summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getExpensesReport = (req, res) => {
    const { startDate, endDate } = req.query;
    const { filter: expFilter, params: expParams } = getDateFilter(startDate, endDate, 'expense_date');

    try {
        const expenses = db.prepare(`
            SELECT id, 'expense' as source, expense_type as type, vehicle as party, amount, expense_date as date, description, notes
            FROM expenses WHERE status = 'active' ${expFilter}
            UNION ALL
            SELECT id, 'other' as source, expense_name as type, 'General' as party, amount, expense_date as date, description, notes
            FROM other_expenses WHERE status = 'active' ${expFilter}
            ORDER BY date DESC
        `).all(...expParams, ...expParams);

        const summary = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        res.json({ expenses, summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTreasuryReport = (req, res) => {
    const { startDate, endDate } = req.query;
    const { filter, params } = getDateFilter(startDate, endDate, 't.date');

    try {
        const transactions = db.prepare(`
            SELECT 
                t.id,
                t.type as flow,
                CASE 
                    WHEN t.type = 'IN' AND t.related_entity_type = 'customer' THEN 'سند قبض عميل'
                    WHEN t.type = 'OUT' AND t.related_entity_type = 'customer' THEN 'سند صرف عميل'
                    WHEN t.type = 'OUT' AND t.related_entity_type IN ('supplier', 'factory') THEN 'سند صرف مورد / مصنع'
                    WHEN t.type = 'IN' AND t.related_entity_type IN ('supplier', 'factory') THEN 'سند قبض مورد / مصنع'
                    WHEN t.type = 'OUT' AND t.related_entity_type = 'worker' THEN 'مسحوبات / سلف عمال'
                    WHEN t.type = 'OUT' AND t.related_entity_type = 'expense' THEN 'مصروفات تشغيل'
                    WHEN t.type = 'OUT' AND t.related_entity_type = 'transfer_out' THEN 'تحويل صادر'
                    WHEN t.type = 'IN' AND t.related_entity_type = 'transfer_in' THEN 'تحويل وارد'
                    WHEN t.type = 'IN' THEN 'توريد نقدية'
                    ELSE 'صرف نقدية'
                END as type,
                COALESCE(
                    CASE 
                        WHEN t.related_entity_type = 'customer' THEN (SELECT name FROM customers WHERE id = t.related_entity_id)
                        WHEN t.related_entity_type IN ('supplier', 'factory') THEN (SELECT name FROM suppliers WHERE id = t.related_entity_id)
                        WHEN t.related_entity_type = 'worker' THEN (SELECT name FROM workers WHERE id = t.related_entity_id)
                        ELSE NULL
                    END,
                    t.description,
                    'عام'
                ) as party,
                t.amount,
                t.date,
                t.description as notes,
                a.name as account_name
            FROM treasury_transactions t
            LEFT JOIN financial_accounts a ON t.account_id = a.id
            WHERE 1=1 ${filter}
            ORDER BY t.date DESC, t.id DESC
        `).all(...params);

        let totalIn = 0;
        let totalOut = 0;
        transactions.forEach(t => {
            if (t.flow === 'IN') totalIn += t.amount;
            else totalOut += t.amount;
        });

        res.json({ transactions, summary: { totalIn, totalOut, net: totalIn - totalOut } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getComprehensiveReport = (req, res) => {
    // A wrapper that fetches high-level metrics for the dashboard
    try {
        const { startDate, endDate } = req.query;
        // In a real scenario, we'd call the logic from above, but for now we can do simplified queries or reuse them.
        
        const { filter: salesFilter, params: salesParams } = getDateFilter(startDate, endDate, 'sale_date');
        const sales = db.prepare(`SELECT SUM(original_amount) as total FROM credit_sales WHERE status != 'CANCELLED' ${salesFilter}`).get(...salesParams);
        
        const { filter: payFilter, params: payParams } = getDateFilter(startDate, endDate, 'payment_date');
        const collections = db.prepare(`SELECT SUM(amount) as total FROM customer_payments WHERE 1=1 ${payFilter}`).get(...payParams);
        
        const { filter: expFilter, params: expParams } = getDateFilter(startDate, endDate, 'expense_date');
        const exp1 = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE status = 'active' ${expFilter}`).get(...expParams);
        const exp2 = db.prepare(`SELECT SUM(amount) as total FROM other_expenses WHERE status = 'active' ${expFilter}`).get(...expParams);

        res.json({
            sales: sales.total || 0,
            collections: collections.total || 0,
            expenses: (exp1.total || 0) + (exp2.total || 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
