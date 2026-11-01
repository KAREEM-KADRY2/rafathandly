const db = require('../db');

function normalizeArabic(str) {
    if (!str) return '';
    let s = String(str).trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
    if (s === 'شيكاره' || s === 'شيكارة' || s === 'شكاره' || s === 'شكارة') return 'شكاره';
    if (s === 'كجم' || s === 'كيلوجرام' || s === 'كيلو جرام') return 'كيلو';
    return s;
}

function buildCostResolver(asOfDate) {
    const invItems = db.prepare('SELECT id, name, unit, secondary_unit, conversion_factor, conversion_operator FROM inventory_items').all();

    let purchQuery = `
        SELECT pi.item_name, pi.total_price, COALESCE(NULLIF(pi.base_quantity, 0), pi.quantity, 0) as qty, pi.unit_price, p.purchase_date
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id
        WHERE (p.status IS NULL OR UPPER(p.status) != 'CANCELLED')
    `;
    const params = [];
    if (asOfDate) {
        purchQuery += ` AND date(p.purchase_date) <= date(?)`;
        params.push(asOfDate);
    }
    purchQuery += ` ORDER BY p.purchase_date DESC, pi.id DESC`;

    const purchRows = db.prepare(purchQuery).all(...params);

    const costSums = new Map();
    const latestPrices = new Map();

    for (const pr of purchRows) {
        const rawName = (pr.item_name || '').trim();
        const normName = normalizeArabic(rawName);

        for (const k of [rawName, normName]) {
            if (!costSums.has(k)) costSums.set(k, { total_cost: 0, total_qty: 0 });
            const entry = costSums.get(k);
            entry.total_cost += Number(pr.total_price) || 0;
            entry.total_qty += Number(pr.qty) || 0;

            if (!latestPrices.has(k) && Number(pr.unit_price) > 0) {
                latestPrices.set(k, Number(pr.unit_price));
            }
        }
    }

    const getInvItem = (itemName) => {
        const raw = (itemName || '').trim();
        const norm = normalizeArabic(raw);
        return invItems.find(i => (i.name || '').trim() === raw || normalizeArabic(i.name) === norm) || null;
    };

    const getAverageCost = (itemName) => {
        const raw = (itemName || '').trim();
        const norm = normalizeArabic(raw);
        if (costSums.has(raw) && costSums.get(raw).total_qty > 0) {
            const e = costSums.get(raw);
            return e.total_cost / e.total_qty;
        }
        if (costSums.has(norm) && costSums.get(norm).total_qty > 0) {
            const e = costSums.get(norm);
            return e.total_cost / e.total_qty;
        }
        if (latestPrices.has(raw)) return latestPrices.get(raw);
        if (latestPrices.has(norm)) return latestPrices.get(norm);
        return 0;
    };

    const calculateItemCost = (item, allocations = []) => {
        if (item.item_type === 'service') {
            const srv = db.prepare('SELECT cost_price FROM services WHERE id = ?').get(item.service_id);
            return (Number(srv?.cost_price) || 0) * (Number(item.quantity) || 0);
        }

        if (allocations && allocations.length > 0) {
            let allocatedCost = 0;
            for (const alloc of allocations) {
                allocatedCost += (Number(alloc.base_quantity || alloc.quantity) * Number(alloc.unit_price));
            }
            if (allocatedCost > 0) return allocatedCost;
        }

        const invItem = getInvItem(item.item_name);
        let qtyInBase = Number(item.quantity) || 0;
        if (invItem && invItem.unit && invItem.secondary_unit && invItem.conversion_factor) {
            const normUnit = normalizeArabic(item.unit);
            const normSec = normalizeArabic(invItem.secondary_unit);
            if (normUnit === normSec || item.unit === invItem.secondary_unit) {
                qtyInBase = (invItem.conversion_operator === '*') ? (qtyInBase * invItem.conversion_factor) : (qtyInBase / invItem.conversion_factor);
            }
        }

        const unitCost = getAverageCost(item.item_name);
        return qtyInBase * unitCost;
    };

    return { getInvItem, getAverageCost, calculateItemCost };
}

// 1. Main Comprehensive Financial Position Report
exports.getFinancialPosition = (req, res) => {
    try {
        const { asOfDate, startDate, endDate } = req.query;
        const asOf = asOfDate || endDate || null;

        const dateCond = (col) => asOf ? ` AND date(${col}) <= date(?)` : '';
        const dateParam = asOf ? [asOf] : [];

        // ------------------------------------------
        // A. Customer Receivables (أموال الشركة لدى العملاء)
        // ------------------------------------------
        const custOpeningRow = db.prepare(`
            SELECT COALESCE(SUM(
                CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END
            ), 0) as total_opening
            FROM opening_balances
            WHERE entity_type = 'customer' ${dateCond('effective_date')}
        `).get(...dateParam);
        const customerOpening = custOpeningRow ? custOpeningRow.total_opening : 0;

        const custSalesRow = db.prepare(`
            SELECT 
                COALESCE(SUM(original_amount), 0) as total_sales,
                COALESCE(SUM(zara_amount), 0) as total_zara,
                COUNT(*) as sales_count
            FROM credit_sales
            WHERE status != 'CANCELLED' ${dateCond('sale_date')}
        `).get(...dateParam);
        const customerSales = custSalesRow ? custSalesRow.total_sales : 0;
        const customerZara = custSalesRow ? custSalesRow.total_zara : 0;

        const custPaymentsRow = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total_paid, COUNT(*) as payments_count
            FROM customer_payments
            WHERE 1=1 ${dateCond('payment_date')}
        `).get(...dateParam);
        const customerPaid = custPaymentsRow ? custPaymentsRow.total_paid : 0;

        const custAdjRow = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total_adjustments, COUNT(*) as adj_count
            FROM customer_adjustments
            WHERE 1=1 ${dateCond('adjustment_date')}
        `).get(...dateParam);
        const customerAdjustments = custAdjRow ? custAdjRow.total_adjustments : 0;

        const totalCustomerReceivables = customerOpening + customerSales - customerPaid - customerAdjustments;

        // Overdue check
        let overdueQuery = `
            SELECT COALESCE(SUM(remaining_amount), 0) as overdue_amount, COUNT(*) as overdue_count
            FROM credit_sales
            WHERE status != 'CANCELLED' AND remaining_amount > 0
        `;
        const overdueParams = [];
        if (asOf) {
            overdueQuery += ` AND date(?) > date(due_date)`;
            overdueParams.push(asOf);
        } else {
            overdueQuery += ` AND date('now', '+3 hours') > date(due_date)`;
        }
        const custOverdueRow = db.prepare(overdueQuery).get(...overdueParams);
        const customerOverdue = custOverdueRow ? custOverdueRow.overdue_amount : 0;

        const allCustomers = db.prepare(`
            SELECT c.id, c.name,
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id ${dateCond('effective_date')}), 0) as opening_balance,
                COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED' ${dateCond('sale_date')}), 0) as total_sales,
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id ${dateCond('payment_date')}), 0) as total_paid,
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = c.id ${dateCond('adjustment_date')}), 0) as total_adj
            FROM customers c
        `).all(...dateParam, ...dateParam, ...dateParam, ...dateParam);

        let indebtedCustomersCount = 0;
        allCustomers.forEach(c => {
            const bal = c.opening_balance + c.total_sales - c.total_paid - c.total_adj;
            if (bal > 0.01) indebtedCustomersCount++;
        });

        // ------------------------------------------
        // B. Supplier Payables (مستحقات الموردين ومقدمات المصانع)
        // ------------------------------------------
        const allSuppliers = db.prepare(`
            SELECT s.id, s.name, s.type,
                COALESCE((SELECT CASE WHEN balance_type = 'credit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type IN ('supplier', 'factory') AND entity_id = s.id ${dateCond('effective_date')}), 0) as opening_balance,
                COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id AND (status IS NULL OR status != 'CANCELLED') ${dateCond('purchase_date')}), 0) as total_purchases,
                COALESCE((SELECT SUM(paid_amount) FROM purchases WHERE supplier_id = s.id AND (status IS NULL OR status != 'CANCELLED') ${dateCond('purchase_date')}), 0) as invoice_paid,
                COALESCE((SELECT SUM(amount) FROM supplier_balance_transactions WHERE supplier_id = s.id AND transaction_type = 'deposit' ${dateCond('created_at')}), 0) as deposits_net
            FROM suppliers s
        `).all(...dateParam, ...dateParam, ...dateParam, ...dateParam);

        let totalSupplierPayables = 0;
        let totalFactoryAdvances = 0;
        let supplierOpeningTotal = 0;
        let supplierPurchasesTotal = 0;
        let supplierPaymentsTotal = 0;
        let indebtedSuppliersCount = 0;

        allSuppliers.forEach(s => {
            supplierOpeningTotal += s.opening_balance;
            supplierPurchasesTotal += s.total_purchases;
            
            if (s.type === 'مصنع') {
                let foQuery = "SELECT amount FROM opening_balances WHERE entity_type IN ('factory', 'supplier') AND entity_id = ?";
                const foParams = [s.id];
                if (asOf) {
                    foQuery += " AND date(effective_date) <= date(?)";
                    foParams.push(asOf);
                }
                const factoryOpening = db.prepare(foQuery).get(...foParams);
                const openAdvance = factoryOpening ? (Number(factoryOpening.amount) || 0) : 0;
                const deposits = s.deposits_net;
                const factoryBalance = openAdvance + deposits - s.total_purchases;
                if (factoryBalance > 0) {
                    totalFactoryAdvances += factoryBalance;
                } else if (factoryBalance < 0) {
                    totalSupplierPayables += Math.abs(factoryBalance);
                    indebtedSuppliersCount++;
                }
            } else {
                let rpQuery = "SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit'";
                const rpParams = [s.id];
                if (asOf) {
                    rpQuery += " AND date(created_at) <= date(?)";
                    rpParams.push(asOf);
                }
                const rawPayments = db.prepare(rpQuery).get(...rpParams);
                const totalPayments = (rawPayments ? rawPayments.total : 0) + (s.invoice_paid || 0);
                supplierPaymentsTotal += totalPayments;
                
                const payable = s.opening_balance + s.total_purchases - totalPayments;
                if (payable > 0.01) {
                    totalSupplierPayables += payable;
                    indebtedSuppliersCount++;
                } else if (payable < -0.01) {
                    totalFactoryAdvances += Math.abs(payable);
                }
            }
        });

        // ------------------------------------------
        // C. Inventory Valuation (قيمة المخزون بالتكلفة)
        // ------------------------------------------
        const costResolver = buildCostResolver(asOf);
        const invItems = db.prepare('SELECT * FROM inventory_items').all();
        let totalInventoryValue = 0;
        let zeroStockCount = 0;
        let negativeStockCount = 0;

        for (const item of invItems) {
            const inRow = db.prepare(`
                SELECT COALESCE(SUM(quantity), 0) as total_in
                FROM inventory_movements
                WHERE item_id = ? AND movement_type IN ('IN', 'ADJUST_IN') ${dateCond('movement_date')}
            `).get(item.id, ...dateParam);

            const outRow = db.prepare(`
                SELECT COALESCE(SUM(quantity), 0) as total_out
                FROM inventory_movements
                WHERE item_id = ? AND movement_type IN ('OUT', 'ADJUST_OUT') ${dateCond('movement_date')}
            `).get(item.id, ...dateParam);

            const inQty = inRow ? inRow.total_in : 0;
            const outQty = outRow ? outRow.total_out : 0;
            const currentStock = inQty - outQty;
            const unitCost = costResolver.getAverageCost(item.name);
            const totalValue = currentStock > 0 ? (currentStock * unitCost) : 0;

            if (currentStock > 0) {
                totalInventoryValue += totalValue;
            } else if (currentStock === 0) {
                zeroStockCount++;
            } else {
                negativeStockCount++;
            }
        }

        // ------------------------------------------
        // D. Cash and Financial Accounts (النقدية والأرصدة)
        // ------------------------------------------
        const accounts = db.prepare('SELECT * FROM financial_accounts ORDER BY id ASC').all();
        let totalLiquidCash = 0;
        let treasuryCash = 0;
        let bankCash = 0;
        let walletCash = 0;

        const accountsWithBalance = accounts.map(acc => {
            const row = db.prepare(`
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as total_in,
                    COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as total_out
                FROM treasury_transactions
                WHERE account_id = ? ${dateCond('date')}
            `).get(acc.id, ...dateParam);

            const currentBal = (row ? row.total_in - row.total_out : 0);
            totalLiquidCash += currentBal;
            if (acc.type === 'CASH') treasuryCash += currentBal;
            else if (acc.type === 'BANK') bankCash += currentBal;
            else if (acc.type === 'EWALLET') walletCash += currentBal;

            return {
                id: acc.id,
                name: acc.name,
                type: acc.type,
                balance: currentBal,
                total_in: row?.total_in || 0,
                total_out: row?.total_out || 0
            };
        });

        // ------------------------------------------
        // E. Period Operating Expenses (المصروفات التشغيلية)
        // ------------------------------------------
        let expDateFilter = "";
        const expParams = [];
        if (startDate) { expDateFilter += " AND date(expense_date) >= date(?)"; expParams.push(startDate); }
        if (endDate) { expDateFilter += " AND date(expense_date) <= date(?)"; expParams.push(endDate); }
        else if (asOf) { expDateFilter += " AND date(expense_date) <= date(?)"; expParams.push(asOf); }

        const generalExp = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE status = 'active' ${expDateFilter}`).get(...expParams);
        const otherExp = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM other_expenses WHERE status = 'active' ${expDateFilter}`).get(...expParams);

        let workerDateFilter = "";
        const workerParams = [];
        if (startDate) { workerDateFilter += " AND date(withdrawal_date) >= date(?)"; workerParams.push(startDate); }
        if (endDate) { workerDateFilter += " AND date(withdrawal_date) <= date(?)"; workerParams.push(endDate); }
        else if (asOf) { workerDateFilter += " AND date(withdrawal_date) <= date(?)"; workerParams.push(asOf); }

        const workerExp = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM worker_withdrawals WHERE status = 'active' ${workerDateFilter}`).get(...workerParams);

        const totalOperatingExpenses = (generalExp?.total || 0) + (otherExp?.total || 0) + (workerExp?.total || 0);

        // ------------------------------------------
        // F. Period Profit & Loss (الأرباح والخسائر)
        // ------------------------------------------
        let pSalesFilter = "";
        const pSalesParams = [];
        if (startDate) { pSalesFilter += " AND date(s.sale_date) >= date(?)"; pSalesParams.push(startDate); }
        if (endDate) { pSalesFilter += " AND date(s.sale_date) <= date(?)"; pSalesParams.push(endDate); }
        else if (asOf) { pSalesFilter += " AND date(s.sale_date) <= date(?)"; pSalesParams.push(asOf); }

        const periodSalesRow = db.prepare(`
            SELECT COALESCE(SUM(s.original_amount), 0) as total_sales, COALESCE(SUM(s.zara_amount), 0) as total_zara
            FROM credit_sales s
            WHERE s.status != 'CANCELLED' ${pSalesFilter}
        `).get(...pSalesParams);

        const periodRevenue = (periodSalesRow?.total_sales || 0) - (periodSalesRow?.total_zara || 0);

        const periodSaleItems = db.prepare(`
            SELECT csi.*
            FROM credit_sale_items csi
            JOIN credit_sales s ON csi.credit_sale_id = s.id
            WHERE s.status != 'CANCELLED' ${pSalesFilter}
        `).all(...pSalesParams);

        let allocMap = new Map();
        try {
            const allAllocations = db.prepare(`
                SELECT a.sale_item_id, a.base_quantity, a.quantity, pi.unit_price
                FROM sale_item_purchase_allocations a
                JOIN purchase_items pi ON a.purchase_item_id = pi.id
            `).all();
            for (const al of allAllocations) {
                if (!allocMap.has(al.sale_item_id)) allocMap.set(al.sale_item_id, []);
                allocMap.get(al.sale_item_id).push(al);
            }
        } catch (e) {}

        let periodCOGS = 0;
        for (const item of periodSaleItems) {
            const itemAllocs = allocMap.get(item.id) || [];
            periodCOGS += costResolver.calculateItemCost(item, itemAllocs);
        }

        const periodGrossProfit = periodRevenue - periodCOGS;
        const periodNetProfit = periodGrossProfit - totalOperatingExpenses;
        const profitMargin = periodRevenue > 0 ? ((periodNetProfit / periodRevenue) * 100) : 0;

        // ------------------------------------------
        // G. Net Capital / Net Financial Position
        // ------------------------------------------
        const totalAssets = totalLiquidCash + totalCustomerReceivables + totalInventoryValue + totalFactoryAdvances;
        const totalLiabilities = totalSupplierPayables;
        const netAssets = totalAssets - totalLiabilities;

        const partners = db.prepare('SELECT * FROM partners').all();
        const hasPartnerRecords = partners && partners.length > 0;
        let totalRegisteredCapital = 0;
        if (hasPartnerRecords) {
            totalRegisteredCapital = partners.reduce((s, p) => s + (Number(p.capital_contribution) || 0), 0);
        }

        res.json({
            asOfDate: asOf || 'اليوم (كامل السجلات)',
            period: { startDate: startDate || null, endDate: endDate || asOf || 'الآن' },
            assets: {
                liquidCash: totalLiquidCash,
                treasuryCash,
                bankCash,
                walletCash,
                customerReceivables: totalCustomerReceivables,
                inventoryAtCost: totalInventoryValue,
                factoryAdvances: totalFactoryAdvances,
                totalAssets
            },
            liabilities: {
                supplierPayables: totalSupplierPayables,
                totalLiabilities
            },
            netPosition: {
                netAssets,
                label: "صافي الأصول / صافي المركز المالي"
            },
            customerSummary: {
                openingBalance: customerOpening,
                totalSales: customerSales,
                totalPaid: customerPaid,
                totalAdjustments: customerAdjustments,
                netReceivables: totalCustomerReceivables,
                overdueAmount: customerOverdue,
                indebtedCustomersCount,
                totalCustomersCount: allCustomers.length
            },
            supplierSummary: {
                openingBalance: supplierOpeningTotal,
                totalPurchases: supplierPurchasesTotal,
                totalPayments: supplierPaymentsTotal,
                netPayables: totalSupplierPayables,
                factoryAdvances: totalFactoryAdvances,
                indebtedSuppliersCount,
                totalSuppliersCount: allSuppliers.length
            },
            inventorySummary: {
                totalValue: totalInventoryValue,
                itemsCount: invItems.length,
                zeroStockCount,
                negativeStockCount
            },
            cashSummary: {
                totalLiquidCash,
                accounts: accountsWithBalance
            },
            expensesSummary: {
                totalExpenses: totalOperatingExpenses,
                generalExpenses: generalExp?.total || 0,
                otherExpenses: otherExp?.total || 0,
                workerWages: workerExp?.total || 0,
                generalCount: generalExp?.count || 0,
                otherCount: otherExp?.count || 0,
                workerCount: workerExp?.count || 0
            },
            profitLossSummary: {
                totalSales: periodSalesRow?.total_sales || 0,
                salesReturnsZara: periodSalesRow?.total_zara || 0,
                netRevenue: periodRevenue,
                cogs: periodCOGS,
                grossProfit: periodGrossProfit,
                operatingExpenses: totalOperatingExpenses,
                netProfit: periodNetProfit,
                profitMargin: Number(profitMargin.toFixed(2))
            },
            equitySummary: {
                hasPartnerRecords,
                registeredCapital: totalRegisteredCapital,
                statusWarning: hasPartnerRecords ? null : "سجلات الشركاء ورأس المال غير مسجلة في السيستم، والصافي ده هو رأس مالك الحقيقي التقديري لو صفينا كل حاجة النهاردة."
            }
        });
    } catch (err) {
        console.error('Error in getFinancialPosition:', err);
        res.status(500).json({ error: err.message });
    }
};

// 2. Customers Drill-down Breakdown
exports.getCustomersBreakdown = (req, res) => {
    try {
        const { asOfDate } = req.query;
        const asOf = asOfDate || null;
        const dateCond = (col) => asOf ? ` AND date(${col}) <= date(?)` : '';
        const dateParam = asOf ? [asOf] : [];

        let overdueSql = asOf 
            ? `COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED' AND remaining_amount > 0 AND date(?) > date(due_date)), 0)`
            : `COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED' AND remaining_amount > 0 AND date('now', '+3 hours') > date(due_date)), 0)`;
        const overdueParams = asOf ? [asOf] : [];

        const customers = db.prepare(`
            SELECT c.id, c.name, c.phone, c.address,
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = c.id ${dateCond('effective_date')}), 0) as opening_balance,
                COALESCE((SELECT COUNT(*) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED' ${dateCond('sale_date')}), 0) as sales_count,
                COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = c.id AND status != 'CANCELLED' ${dateCond('sale_date')}), 0) as total_sales,
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = c.id ${dateCond('payment_date')}), 0) as total_paid,
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = c.id ${dateCond('adjustment_date')}), 0) as total_adjustments,
                ${overdueSql} as overdue_amount
            FROM customers c
            ORDER BY c.name ASC
        `).all(...dateParam, ...dateParam, ...dateParam, ...dateParam, ...dateParam, ...overdueParams);

        const list = customers.map(c => {
            const remaining = (c.opening_balance || 0) + (c.total_sales || 0) - (c.total_paid || 0) - (c.total_adjustments || 0);
            return {
                ...c,
                remaining_balance: remaining
            };
        });

        res.json({ customers: list, asOfDate: asOf || 'الآن' });
    } catch (err) {
        console.error('Error in getCustomersBreakdown:', err);
        res.status(500).json({ error: err.message });
    }
};

// 3. Suppliers Drill-down Breakdown
exports.getSuppliersBreakdown = (req, res) => {
    try {
        const { asOfDate } = req.query;
        const asOf = asOfDate || null;
        const dateCond = (col) => asOf ? ` AND date(${col}) <= date(?)` : '';
        const dateParam = asOf ? [asOf] : [];

        const suppliers = db.prepare(`
            SELECT s.id, s.name, s.type, s.phone,
                COALESCE((SELECT CASE WHEN balance_type = 'credit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type IN ('supplier', 'factory') AND entity_id = s.id ${dateCond('effective_date')}), 0) as opening_balance,
                COALESCE((SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id AND (status IS NULL OR status != 'CANCELLED') ${dateCond('purchase_date')}), 0) as purchases_count,
                COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = s.id AND (status IS NULL OR status != 'CANCELLED') ${dateCond('purchase_date')}), 0) as total_purchases,
                COALESCE((SELECT SUM(paid_amount) FROM purchases WHERE supplier_id = s.id AND (status IS NULL OR status != 'CANCELLED') ${dateCond('purchase_date')}), 0) as invoice_paid,
                COALESCE((SELECT SUM(amount) FROM supplier_balance_transactions WHERE supplier_id = s.id AND transaction_type = 'deposit' ${dateCond('created_at')}), 0) as deposits_net
            FROM suppliers s
            ORDER BY s.name ASC
        `).all(...dateParam, ...dateParam, ...dateParam, ...dateParam, ...dateParam);

        const list = suppliers.map(s => {
            let balance = 0;
            let classification = 'supplier_payable';

            if (s.type === 'مصنع') {
                let foQuery = "SELECT amount FROM opening_balances WHERE entity_type IN ('factory', 'supplier') AND entity_id = ?";
                const foParams = [s.id];
                if (asOf) {
                    foQuery += " AND date(effective_date) <= date(?)";
                    foParams.push(asOf);
                }
                const factoryOpening = db.prepare(foQuery).get(...foParams);
                const openAdvance = factoryOpening ? (Number(factoryOpening.amount) || 0) : 0;
                balance = openAdvance + s.deposits_net - s.total_purchases;
                classification = balance >= 0 ? 'factory_advance' : 'supplier_payable';
            } else {
                let rpQuery = "SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM supplier_balance_transactions WHERE supplier_id = ? AND transaction_type = 'deposit'";
                const rpParams = [s.id];
                if (asOf) {
                    rpQuery += " AND date(created_at) <= date(?)";
                    rpParams.push(asOf);
                }
                const rawPayments = db.prepare(rpQuery).get(...rpParams);
                const totalPayments = (rawPayments ? rawPayments.total : 0) + (s.invoice_paid || 0);
                balance = s.opening_balance + s.total_purchases - totalPayments;
                classification = balance >= 0 ? 'supplier_payable' : 'factory_advance';
            }

            return {
                ...s,
                current_balance: Math.abs(balance),
                raw_balance: balance,
                classification: classification,
                classification_label: classification === 'factory_advance' ? 'رصيد لينا مقدم للمصنع' : 'دين علينا للمورد'
            };
        });

        res.json({ suppliers: list, asOfDate: asOf || 'الآن' });
    } catch (err) {
        console.error('Error in getSuppliersBreakdown:', err);
        res.status(500).json({ error: err.message });
    }
};

// 4. Inventory Drill-down Breakdown
exports.getInventoryBreakdown = (req, res) => {
    try {
        const { asOfDate } = req.query;
        const asOf = asOfDate || null;
        const dateCond = (col) => asOf ? ` AND date(${col}) <= date(?)` : '';
        const dateParam = asOf ? [asOf] : [];

        const costResolver = buildCostResolver(asOf);
        const invItems = db.prepare('SELECT * FROM inventory_items ORDER BY name ASC').all();

        const items = invItems.map(item => {
            const inRow = db.prepare(`
                SELECT COALESCE(SUM(quantity), 0) as total_in
                FROM inventory_movements
                WHERE item_id = ? AND movement_type IN ('IN', 'ADJUST_IN') ${dateCond('movement_date')}
            `).get(item.id, ...dateParam);

            const outRow = db.prepare(`
                SELECT COALESCE(SUM(quantity), 0) as total_out
                FROM inventory_movements
                WHERE item_id = ? AND movement_type IN ('OUT', 'ADJUST_OUT') ${dateCond('movement_date')}
            `).get(item.id, ...dateParam);

            const inQty = inRow ? inRow.total_in : 0;
            const outQty = outRow ? outRow.total_out : 0;
            const currentStock = inQty - outQty;
            const unitCost = costResolver.getAverageCost(item.name);
            const totalValue = currentStock > 0 ? (currentStock * unitCost) : 0;

            let status = 'available';
            let statusLabel = 'متوفر';
            if (currentStock === 0) {
                status = 'zero';
                statusLabel = 'خلصان';
            } else if (currentStock < 0) {
                status = 'negative';
                statusLabel = 'رصيد سالب';
            }

            return {
                id: item.id,
                name: item.name,
                unit: item.unit,
                in_quantity: inQty,
                out_quantity: outQty,
                current_stock: currentStock,
                unit_cost: unitCost,
                total_value: totalValue,
                status,
                status_label: statusLabel
            };
        });

        res.json({ inventory: items, asOfDate: asOf || 'الآن' });
    } catch (err) {
        console.error('Error in getInventoryBreakdown:', err);
        res.status(500).json({ error: err.message });
    }
};

// 5. Cash Accounts Drill-down Breakdown
exports.getCashBreakdown = (req, res) => {
    try {
        const { asOfDate } = req.query;
        const asOf = asOfDate || null;
        const dateCond = (col) => asOf ? ` AND date(${col}) <= date(?)` : '';
        const dateParam = asOf ? [asOf] : [];

        const accounts = db.prepare('SELECT * FROM financial_accounts ORDER BY id ASC').all();

        const list = accounts.map(acc => {
            const row = db.prepare(`
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as total_in,
                    COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as total_out,
                    COUNT(*) as tx_count
                FROM treasury_transactions
                WHERE account_id = ? ${dateCond('date')}
            `).get(acc.id, ...dateParam);

            const currentBal = (row ? row.total_in - row.total_out : 0);
            return {
                id: acc.id,
                name: acc.name,
                type: acc.type,
                type_label: acc.type === 'CASH' ? 'خزينة كاش' : (acc.type === 'BANK' ? 'حساب بنكي' : 'محفظة إلكترونية'),
                balance: currentBal,
                total_in: row?.total_in || 0,
                total_out: row?.total_out || 0,
                transactions_count: row?.tx_count || 0
            };
        });

        res.json({ accounts: list, asOfDate: asOf || 'الآن' });
    } catch (err) {
        console.error('Error in getCashBreakdown:', err);
        res.status(500).json({ error: err.message });
    }
};

// 6. Expenses Drill-down Breakdown
exports.getExpensesBreakdown = (req, res) => {
    try {
        const { startDate, endDate, asOfDate } = req.query;
        const end = endDate || asOfDate || null;

        let expDateFilter = "";
        const expParams = [];
        if (startDate) { expDateFilter += " AND date(expense_date) >= date(?)"; expParams.push(startDate); }
        if (end) { expDateFilter += " AND date(expense_date) <= date(?)"; expParams.push(end); }

        const generalExps = db.prepare(`
            SELECT id, amount, expense_date as date, description, expense_type as sub_type, 'مصروف تشغيل' as category, document_number
            FROM expenses
            WHERE status = 'active' ${expDateFilter}
        `).all(...expParams);

        const otherExps = db.prepare(`
            SELECT id, amount, expense_date as date, description, expense_name as sub_type, 'مصروف نثري' as category, document_number
            FROM other_expenses
            WHERE status = 'active' ${expDateFilter}
        `).all(...expParams);

        let workerDateFilter = "";
        const workerParams = [];
        if (startDate) { workerDateFilter += " AND date(w.withdrawal_date) >= date(?)"; workerParams.push(startDate); }
        if (end) { workerDateFilter += " AND date(w.withdrawal_date) <= date(?)"; workerParams.push(end); }

        const workerExps = db.prepare(`
            SELECT w.id, w.amount, w.withdrawal_date as date, 'سحب/سلفة: ' || wr.name as description, w.withdrawal_type as sub_type, 'أجور ومسحوبات عمال' as category, w.document_number
            FROM worker_withdrawals w
            JOIN workers wr ON w.worker_id = wr.id
            WHERE w.status = 'active' ${workerDateFilter}
        `).all(...workerParams);

        const all = [...generalExps, ...otherExps, ...workerExps];
        all.sort((a, b) => new Date(b.date) - new Date(a.date));

        const total = all.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        res.json({
            expenses: all,
            total,
            count: all.length,
            period: { startDate: startDate || null, endDate: end || 'الآن' }
        });
    } catch (err) {
        console.error('Error in getExpensesBreakdown:', err);
        res.status(500).json({ error: err.message });
    }
};

// 7. Profit & Loss Drill-down Breakdown
exports.getProfitBreakdown = (req, res) => {
    try {
        const { startDate, endDate, asOfDate } = req.query;
        const end = endDate || asOfDate || null;

        let pSalesFilter = "";
        const pSalesParams = [];
        if (startDate) { pSalesFilter += " AND date(s.sale_date) >= date(?)"; pSalesParams.push(startDate); }
        if (end) { pSalesFilter += " AND date(s.sale_date) <= date(?)"; pSalesParams.push(end); }

        const costResolver = buildCostResolver(end);

        const saleItems = db.prepare(`
            SELECT csi.*, s.invoice_number, s.sale_date, c.name as customer_name
            FROM credit_sale_items csi
            JOIN credit_sales s ON csi.credit_sale_id = s.id
            JOIN customers c ON s.customer_id = c.id
            WHERE s.status != 'CANCELLED' ${pSalesFilter}
            ORDER BY s.sale_date DESC, csi.id DESC
        `).all(...pSalesParams);

        let allocMap = new Map();
        try {
            const allAllocations = db.prepare(`
                SELECT a.sale_item_id, a.base_quantity, a.quantity, pi.unit_price
                FROM sale_item_purchase_allocations a
                JOIN purchase_items pi ON a.purchase_item_id = pi.id
            `).all();
            for (const al of allAllocations) {
                if (!allocMap.has(al.sale_item_id)) allocMap.set(al.sale_item_id, []);
                allocMap.get(al.sale_item_id).push(al);
            }
        } catch (e) {}

        let totalRevenue = 0;
        let totalCOGS = 0;

        const detailedItems = saleItems.map(item => {
            const itemAllocs = allocMap.get(item.id) || [];
            const cost = costResolver.calculateItemCost(item, itemAllocs);
            const revenue = Number(item.total_price) || 0;
            const profit = revenue - cost;
            const margin = revenue > 0 ? ((profit / revenue) * 100) : 0;

            totalRevenue += revenue;
            totalCOGS += cost;

            return {
                id: item.id,
                sale_id: item.credit_sale_id,
                invoice_number: item.invoice_number,
                sale_date: item.sale_date,
                customer_name: item.customer_name,
                item_name: item.item_name,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unit_price,
                total_revenue: revenue,
                total_cost: cost,
                gross_profit: profit,
                profit_margin: Number(margin.toFixed(2))
            };
        });

        // Period expenses
        let expDateFilter = "";
        const expParams = [];
        if (startDate) { expDateFilter += " AND date(expense_date) >= date(?)"; expParams.push(startDate); }
        if (end) { expDateFilter += " AND date(expense_date) <= date(?)"; expParams.push(end); }

        const generalExp = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'active' ${expDateFilter}`).get(...expParams)?.total || 0;
        const otherExp = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM other_expenses WHERE status = 'active' ${expDateFilter}`).get(...expParams)?.total || 0;

        let workerDateFilter = "";
        const workerParams = [];
        if (startDate) { workerDateFilter += " AND date(withdrawal_date) >= date(?)"; workerParams.push(startDate); }
        if (end) { workerDateFilter += " AND date(withdrawal_date) <= date(?)"; workerParams.push(end); }

        const workerExp = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM worker_withdrawals WHERE status = 'active' ${workerDateFilter}`).get(...workerParams)?.total || 0;

        const totalExpenses = generalExp + otherExp + workerExp;
        const grossProfit = totalRevenue - totalCOGS;
        const netProfit = grossProfit - totalExpenses;

        res.json({
            items: detailedItems,
            summary: {
                total_revenue: totalRevenue,
                total_cogs: totalCOGS,
                gross_profit: grossProfit,
                total_expenses: totalExpenses,
                net_profit: netProfit,
                profit_margin: totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(2)) : 0
            },
            period: { startDate: startDate || null, endDate: end || 'الآن' }
        });
    } catch (err) {
        console.error('Error in getProfitBreakdown:', err);
        res.status(500).json({ error: err.message });
    }
};
