const db = require('../db');

function getDateFilter(startDate, endDate, colName) {
    let filter = "";
    const params = [];
    if (startDate) { filter += ` AND date(${colName}) >= date(?)`; params.push(startDate); }
    if (endDate) { filter += ` AND date(${colName}) <= date(?)`; params.push(endDate); }
    return { filter, params };
}

// 1. Sales Report
exports.getSales = (req, res) => {
    try {
        const { startDate, endDate, export: exportParam, all } = req.query;
        const { filter, params } = getDateFilter(startDate, endDate, 's.sale_date');

        const invItems = db.prepare('SELECT name, unit, secondary_unit, conversion_factor, conversion_operator FROM inventory_items').all();
        const invMap = new Map(invItems.map(i => [i.name, i]));

        const costs = db.prepare('SELECT item_name, SUM(total_price) as total_cost, SUM(base_quantity) as total_qty FROM purchase_items GROUP BY item_name').all();
        const costMap = new Map(costs.map(c => [c.item_name, c.total_qty > 0 ? c.total_cost / c.total_qty : 0]));

        const summaryRow = db.prepare(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(s.original_amount), 0) as total_sales,
                COALESCE(SUM(s.paid_amount), 0) as total_paid,
                COALESCE(SUM(s.remaining_amount), 0) as total_remaining
            FROM credit_sales s
            WHERE s.status != 'CANCELLED' ${filter}
        `).get(...params);

        let query = `
            SELECT s.*, c.name as customer_name,
                   (SELECT COUNT(*) FROM credit_sale_items WHERE credit_sale_id = s.id) as items_count
            FROM credit_sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.status != 'CANCELLED' ${filter}
            ORDER BY s.sale_date DESC
        `;

        let sales;
        let page = 1, limit = 50, totalPages = 1, total = summaryRow?.count || 0;

        const isUnpaginated = exportParam === 'true' || all === 'true' || (!req.query.page && !req.query.limit);

        if (isUnpaginated) {
            sales = db.prepare(query).all(...params);
        } else {
            page = Math.max(1, parseInt(req.query.page) || 1);
            limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
            const offset = (page - 1) * limit;
            totalPages = Math.ceil(total / limit) || 1;

            query += ` LIMIT ? OFFSET ?`;
            sales = db.prepare(query).all(...params, limit, offset);
        }

        let totalCost = 0;
        let totalProfit = 0;

        if (sales.length > 0) {
            const saleIds = sales.map(s => s.id);
            const placeholders = saleIds.map(() => '?').join(',');
            const allItems = db.prepare(`SELECT * FROM credit_sale_items WHERE credit_sale_id IN (${placeholders})`).all(...saleIds);

            const itemsBySale = {};
            for (const item of allItems) {
                if (!itemsBySale[item.credit_sale_id]) itemsBySale[item.credit_sale_id] = [];
                itemsBySale[item.credit_sale_id].push(item);
            }

            for (const s of sales) {
                const items = itemsBySale[s.id] || [];
                let invoiceCost = 0;
                for (const item of items) {
                    const invItem = invMap.get(item.item_name);
                    let qtyInBase = item.quantity;
                    if (invItem && invItem.unit !== item.unit && invItem.secondary_unit === item.unit) {
                        if (invItem.conversion_operator === '*') {
                            qtyInBase = item.quantity * (invItem.conversion_factor || 1);
                        } else {
                            qtyInBase = item.quantity / (invItem.conversion_factor || 1);
                        }
                    }
                    const unitCost = costMap.get(item.item_name) || 0;
                    invoiceCost += (qtyInBase * unitCost);
                }

                const profit = s.original_amount - invoiceCost;
                s.cost = invoiceCost;
                s.profit = profit;

                totalCost += invoiceCost;
                totalProfit += profit;
            }
        }

        const summary = {
            total_sales: summaryRow?.total_sales || 0,
            total_paid: summaryRow?.total_paid || 0,
            total_remaining: summaryRow?.total_remaining || 0,
            total_cost: totalCost,
            total_profit: totalProfit,
            count: total
        };

        res.json({
            sales,
            items: sales,
            summary,
            total,
            page,
            limit,
            totalPages
        });
    } catch (error) {
        console.error('Error in getSales report:', error);
        res.status(500).json({ error: error.message });
    }
};

// 2. Purchases Report
exports.getPurchases = (req, res) => {
    try {
        const { startDate, endDate, export: exportParam, all } = req.query;
        const { filter, params } = getDateFilter(startDate, endDate, 'p.purchase_date');

        const summaryRow = db.prepare(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(p.total_amount), 0) as total_purchases,
                COALESCE(SUM(p.paid_amount), 0) as total_paid,
                COALESCE(SUM(p.remaining_amount), 0) as total_remaining
            FROM purchases p
            WHERE 1=1 ${filter}
        `).get(...params);

        let query = `
            SELECT p.*, s.name as supplier_name,
                   (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as items_count
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE 1=1 ${filter}
            ORDER BY p.purchase_date DESC
        `;

        let purchases;
        let page = 1, limit = 50, totalPages = 1, total = summaryRow?.count || 0;

        const isUnpaginated = exportParam === 'true' || all === 'true' || (!req.query.page && !req.query.limit);

        if (isUnpaginated) {
            purchases = db.prepare(query).all(...params);
        } else {
            page = Math.max(1, parseInt(req.query.page) || 1);
            limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
            const offset = (page - 1) * limit;
            totalPages = Math.ceil(total / limit) || 1;

            query += ` LIMIT ? OFFSET ?`;
            purchases = db.prepare(query).all(...params, limit, offset);
        }

        const summary = {
            total_purchases: summaryRow?.total_purchases || 0,
            total_paid: summaryRow?.total_paid || 0,
            total_remaining: summaryRow?.total_remaining || 0,
            count: total
        };

        res.json({
            purchases,
            items: purchases,
            summary,
            total,
            page,
            limit,
            totalPages
        });
    } catch (error) {
        console.error('Error in getPurchases report:', error);
        res.status(500).json({ error: error.message });
    }
};

// 3. P&L Report
exports.getProfitLoss = (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const salesFilter = getDateFilter(startDate, endDate, 'sale_date');
        const totalSalesRow = db.prepare(`SELECT COALESCE(SUM(original_amount), 0) as val FROM credit_sales WHERE status != 'CANCELLED' ${salesFilter.filter}`).get(...salesFilter.params);
        const totalSales = totalSalesRow.val;

        const invItems = db.prepare('SELECT name, unit, secondary_unit, conversion_factor, conversion_operator FROM inventory_items').all();
        const invMap = new Map(invItems.map(i => [i.name, i]));

        const costs = db.prepare('SELECT item_name, SUM(total_price) as total_cost, SUM(base_quantity) as total_qty FROM purchase_items GROUP BY item_name').all();
        const costMap = new Map(costs.map(c => [c.item_name, c.total_qty > 0 ? c.total_cost / c.total_qty : 0]));

        const cogsItems = db.prepare(`
            SELECT csi.item_name, csi.quantity, csi.unit
            FROM credit_sale_items csi
            JOIN credit_sales s ON csi.credit_sale_id = s.id
            WHERE s.status != 'CANCELLED' ${salesFilter.filter}
        `).all(...salesFilter.params);

        let totalCogs = 0;
        for (const item of cogsItems) {
            const invItem = invMap.get(item.item_name);
            let qtyInBase = item.quantity;
            if (invItem && invItem.unit !== item.unit && invItem.secondary_unit === item.unit) {
                if (invItem.conversion_operator === '*') {
                    qtyInBase = item.quantity * (invItem.conversion_factor || 1);
                } else {
                    qtyInBase = item.quantity / (invItem.conversion_factor || 1);
                }
            }
            const unitCost = costMap.get(item.item_name) || 0;
            totalCogs += (qtyInBase * unitCost);
        }

        const grossProfit = totalSales - totalCogs;

        const expFilter = getDateFilter(startDate, endDate, 'expense_date');
        const exps = db.prepare(`SELECT COALESCE(SUM(amount), 0) as val FROM expenses WHERE status = 'active' ${expFilter.filter}`).get(...expFilter.params).val;
        const otherExps = db.prepare(`SELECT COALESCE(SUM(amount), 0) as val FROM other_expenses WHERE status = 'active' ${expFilter.filter}`).get(...expFilter.params).val;
        
        const workerWithFilter = getDateFilter(startDate, endDate, 'withdrawal_date');
        const workerExps = db.prepare(`SELECT COALESCE(SUM(amount), 0) as val FROM worker_withdrawals WHERE status = 'active' ${workerWithFilter.filter}`).get(...workerWithFilter.params).val;
        
        const totalAllExpenses = exps + otherExps + workerExps;
        const netProfit = grossProfit - totalAllExpenses;

        res.json({
            total_sales: totalSales,
            cogs: totalCogs,
            gross_profit: grossProfit,
            expenses: totalAllExpenses,
            net_profit: netProfit,
            breakdown: {
                general_expenses: exps,
                other_expenses: otherExps,
                worker_withdrawals: workerExps
            }
        });
    } catch (error) {
        console.error('Error in getProfitLoss:', error);
        res.status(500).json({ error: error.message });
    }
};

// 4. Expenses Report
exports.getExpenses = (req, res) => {
    try {
        const { startDate, endDate, export: exportParam, all } = req.query;
        
        const expFilter = getDateFilter(startDate, endDate, 'expense_date');
        const exps = db.prepare(`SELECT id, amount, expense_date as date, description, 'مصروف تشغيل' as expense_type, document_number as reference_number FROM expenses WHERE status = 'active' ${expFilter.filter}`).all(...expFilter.params);
        
        const otherExps = db.prepare(`SELECT id, amount, expense_date as date, description, 'مصروف نثري' as expense_type, document_number as reference_number FROM other_expenses WHERE status = 'active' ${expFilter.filter}`).all(...expFilter.params);
        
        const workerWithFilter = getDateFilter(startDate, endDate, 'withdrawal_date');
        const workerExps = db.prepare(`
            SELECT w.id, w.amount, w.withdrawal_date as date, 'سحب عامل: ' || wr.name as description, 'سلفة/سحب عامل' as expense_type, '' as reference_number 
            FROM worker_withdrawals w
            JOIN workers wr ON w.worker_id = wr.id
            WHERE w.status = 'active' ${workerWithFilter.filter}
        `).all(...workerWithFilter.params);

        const allExpenses = [...exps, ...otherExps, ...workerExps];
        allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        const total = allExpenses.reduce((sum, e) => sum + e.amount, 0);

        const isUnpaginated = exportParam === 'true' || all === 'true' || (!req.query.page && !req.query.limit);

        let paginatedExpenses = allExpenses;
        let page = 1, limit = 50, totalPages = 1;

        if (!isUnpaginated) {
            page = Math.max(1, parseInt(req.query.page) || 1);
            limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
            const offset = (page - 1) * limit;
            totalPages = Math.ceil(allExpenses.length / limit) || 1;
            paginatedExpenses = allExpenses.slice(offset, offset + limit);
        }

        res.json({
            expenses: paginatedExpenses,
            items: paginatedExpenses,
            total: allExpenses.length,
            page,
            limit,
            totalPages,
            summary: { total_expenses: total, count: allExpenses.length }
        });
    } catch(err) {
        console.error('Error in getExpenses report:', err);
        res.status(500).json({ error: err.message });
    }
};

// 5. Inventory Movements
exports.getInventoryMovements = (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { filter, params } = getDateFilter(startDate, endDate, 'm.created_at');
        
        const movements = db.prepare(`
            SELECT m.*, i.name as product_name
            FROM inventory_movements m
            JOIN inventory_items i ON m.item_id = i.id
            WHERE 1=1 ${filter}
            ORDER BY m.created_at DESC
        `).all(...params);

        res.json(movements);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

// 6. All Products Profitability
exports.getAllProducts = (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const items = db.prepare('SELECT * FROM inventory_items').all();
        
        const salesFilter = getDateFilter(startDate, endDate, 's.sale_date');
        const purchFilter = getDateFilter(startDate, endDate, 'p.purchase_date');

        const products = items.map(item => {
            // Purchase cost avg (all time for accurate cost)
            const row = db.prepare(`SELECT SUM(total_price) as total_cost, SUM(base_quantity) as total_qty FROM purchase_items WHERE item_name = ?`).get(item.name);
            let avgCost = (row && row.total_qty > 0) ? (row.total_cost / row.total_qty) : 0;

            // Purchased Qty in period
            const purchQtyRow = db.prepare(`
                SELECT SUM(pi.base_quantity) as qty, SUM(pi.total_price) as cost
                FROM purchase_items pi
                JOIN purchases p ON pi.purchase_id = p.id
                WHERE pi.item_name = ? ${purchFilter.filter.replace(/p\./g, 'p.')}
            `).get(item.name, ...purchFilter.params);

            // Sold Qty in period
            // Need to convert sales qty to base qty for accurate summing
            const salesItems = db.prepare(`
                SELECT si.quantity, si.unit, si.total_price 
                FROM credit_sale_items si
                JOIN credit_sales s ON si.credit_sale_id = s.id
                WHERE si.item_name = ? AND s.status != 'CANCELLED' ${salesFilter.filter.replace(/s\./g, 's.')}
            `).all(item.name, ...salesFilter.params);

            let soldQtyBase = 0;
            let salesRevenue = 0;
            salesItems.forEach(si => {
                let q = si.quantity;
                if (si.unit !== item.unit && item.secondary_unit === si.unit) {
                    if (item.conversion_operator === '*') {
                        q = si.quantity * (item.conversion_factor || 1);
                    } else {
                        q = si.quantity / (item.conversion_factor || 1);
                    }
                }
                soldQtyBase += q;
                salesRevenue += si.total_price;
            });

            const cogs = soldQtyBase * avgCost;
            const profit = salesRevenue - cogs;

            return {
                ...item,
                purchased_qty: purchQtyRow.qty || 0,
                purchase_cost: purchQtyRow.cost || 0,
                sold_qty: soldQtyBase,
                sales_revenue: salesRevenue,
                profit: profit,
                avg_unit_cost: avgCost
            };
        });

        res.json(products);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

// 7. Customers List
exports.getCustomers = (req, res) => {
    try {
        const customers = db.prepare(`
            SELECT c.*,
                   COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id), 0) as opening_balance,
                   COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED'), 0) as total_purchases,
                   COALESCE((SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) FROM customer_payments WHERE customer_id = c.id), 0) as total_paid,
                   COALESCE((SELECT COUNT(*) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED'), 0) as invoices_count,
                   (
                       COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id), 0) +
                       COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED'), 0) -
                       COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id), 0) -
                       COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = c.id), 0)
                   ) as total_remaining
            FROM customers c
            ORDER BY total_remaining DESC
        `).all();

        let totalOpening = 0;
        let totalPurchases = 0;
        let totalPaid = 0;
        let totalRemaining = 0;

        customers.forEach(c => {
            totalOpening += (c.opening_balance || 0);
            totalPurchases += (c.total_purchases || 0);
            totalPaid += (c.total_paid || 0);
            totalRemaining += (c.total_remaining || 0);
        });

        const summary = {
            total_opening: totalOpening,
            total_purchases: totalPurchases,
            total_paid: totalPaid,
            total_remaining: totalRemaining,
            count: customers.length
        };

        res.json({ customers, summary });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

// 8. Suppliers List
exports.getSuppliers = (req, res) => {
    try {
        const suppliers = db.prepare(`
            SELECT s.*,
                   COALESCE((SELECT CASE WHEN balance_type = 'credit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type IN ('supplier', 'factory') AND entity_id = s.id), 0) as opening_balance,
                   COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id), 0) as total_purchases,
                   COALESCE((SELECT SUM(paid_amount) FROM purchases WHERE supplier_id = s.id), 0) as total_paid,
                   COALESCE((SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id), 0) as invoices_count,
                   s.balance as total_remaining
            FROM suppliers s
            ORDER BY total_purchases DESC
        `).all();

        let totalOpening = 0;
        let totalPurchases = 0;
        let totalPaid = 0;
        let totalRemaining = 0;

        suppliers.forEach(s => {
            totalOpening += (s.opening_balance || 0);
            totalPurchases += (s.total_purchases || 0);
            totalPaid += (s.total_paid || 0);
            totalRemaining += (s.total_remaining || 0);
        });

        const summary = {
            total_opening: totalOpening,
            total_purchases: totalPurchases,
            total_paid: totalPaid,
            total_remaining: totalRemaining,
            count: suppliers.length
        };

        res.json({ suppliers, summary });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
};

// 9. Partners & Withdrawals Report
exports.getPartners = (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateCond = "";
        const dateParams = [];
        if (startDate) { dateCond += " AND date(pt.transaction_date) >= date(?)"; dateParams.push(startDate); }
        if (endDate) { dateCond += " AND date(pt.transaction_date) <= date(?)"; dateParams.push(endDate); }

        const rawPartners = db.prepare('SELECT * FROM partners ORDER BY is_active DESC, share_percentage DESC, id ASC').all();

        const partners = rawPartners.map(p => {
            const registeredCapital = Number(p.capital_contribution) || 0;

            // Period statistics (excluding cancelled)
            const periodStats = db.prepare(`
                SELECT 
                    COALESCE(SUM(CASE WHEN transaction_type = 'capital_contribution' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_capital_contributions,
                    COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_withdrawals,
                    COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal_return' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_returned,
                    COALESCE(SUM(CASE WHEN transaction_type = 'payment' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_payments,
                    COALESCE(SUM(CASE WHEN transaction_type = 'profit_distribution' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as total_profit_distributions,
                    COUNT(CASE WHEN transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') THEN 1 END) as withdrawals_count,
                    COUNT(CASE WHEN (status IS NULL OR status != 'cancelled') THEN 1 END) as transactions_count,
                    MAX(CASE WHEN transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') THEN transaction_date END) as last_withdrawal_date
                FROM partner_transactions pt
                WHERE pt.partner_id = ? ${dateCond}
            `).get(p.id, ...dateParams);

            // All-time statistics for true current balance
            const allTimeStats = db.prepare(`
                SELECT 
                    COALESCE(SUM(CASE WHEN transaction_type = 'capital_contribution' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as all_capital,
                    COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as all_withdrawals,
                    COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal_return' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as all_returned,
                    COALESCE(SUM(CASE WHEN transaction_type = 'payment' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as all_payments,
                    COALESCE(SUM(CASE WHEN transaction_type = 'profit_distribution' AND (status IS NULL OR status != 'cancelled') THEN amount ELSE 0 END), 0) as all_profits
                FROM partner_transactions
                WHERE partner_id = ?
            `).get(p.id);

            const allCapital = registeredCapital + (allTimeStats?.all_capital || 0);
            const allNetWithdrawals = Math.max(0, (allTimeStats?.all_withdrawals || 0) - (allTimeStats?.all_returned || 0));
            const allDraws = allNetWithdrawals + (allTimeStats?.all_payments || 0) + (allTimeStats?.all_profits || 0);
            // Capital is 100% intact - withdrawals are never deducted from capital
            const currentBalance = allCapital;

            const totalCapital = registeredCapital + (periodStats.total_capital_contributions || 0);
            const totalWithdrawals = periodStats.total_withdrawals || 0;
            const totalReturned = periodStats.total_returned || 0;
            const netWithdrawals = Math.max(0, totalWithdrawals - totalReturned);

            return {
                id: p.id,
                name: p.name,
                phone: p.phone || '-',
                percentage: p.share_percentage || 0,
                capital_contribution: registeredCapital,
                total_capital: totalCapital,
                total_withdrawals: totalWithdrawals,
                total_returned: totalReturned,
                net_withdrawals: netWithdrawals,
                total_payments: periodStats.total_payments || 0,
                total_profit_distributions: periodStats.total_profit_distributions || 0,
                transactions_count: periodStats.transactions_count || 0,
                withdrawals_count: periodStats.withdrawals_count || 0,
                last_withdrawal_date: periodStats.last_withdrawal_date || '-',
                current_balance: currentBalance,
                is_active: p.is_active,
                status: p.is_active ? 'active' : 'archived'
            };
        });

        // Transactions list in the period
        const txQuery = `
            SELECT pt.*, p.name as partner_name, p.share_percentage as partner_percentage,
                   fa.name as account_name,
                   orig.notes as original_withdrawal_notes,
                   orig.amount as original_withdrawal_amount
            FROM partner_transactions pt
            JOIN partners p ON pt.partner_id = p.id
            LEFT JOIN financial_accounts fa ON pt.account_id = fa.id
            LEFT JOIN partner_transactions orig ON pt.parent_transaction_id = orig.id
            WHERE 1=1 ${dateCond}
            ORDER BY pt.transaction_date DESC, pt.id DESC
        `;
        const transactions = db.prepare(txQuery).all(...dateParams);

        // System-wide summary
        let totalCapital = 0;
        let totalWithdrawals = 0;
        let totalReturned = 0;
        let netWithdrawals = 0;
        let totalBalance = 0;
        let totalTransactions = 0;

        partners.filter(p => p.is_active).forEach(p => {
            totalCapital += (p.capital_contribution || 0);
            totalWithdrawals += (p.total_withdrawals || 0);
            totalReturned += (p.total_returned || 0);
            netWithdrawals += (p.net_withdrawals || 0);
            totalBalance += (p.current_balance || 0);
            totalTransactions += (p.transactions_count || 0);
        });

        const summary = {
            total_capital: totalCapital,
            total_withdrawals: totalWithdrawals,
            total_returned: totalReturned,
            net_withdrawals: netWithdrawals,
            total_balance: totalBalance,
            total_transactions: totalTransactions,
            count: partners.filter(p => p.is_active).length
        };

        res.json({ partners, summary, transactions });
    } catch (err) {
        console.error('Error fetching partners report:', err);
        res.status(500).json({ error: err.message });
    }
};
