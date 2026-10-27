const db = require('../db');

/**
 * =============================================
 * صافي الربح - Net Profit Controller
 * =============================================
 * يحسب صافي الربح الحقيقي من قاعدة البيانات
 * بدون أي أرقام وهمية أو حسابات ثابتة
 */

/**
 * جلب أسعار التكلفة الحقيقية من سجلات الشراء
 * يستخدم آخر سعر شراء معروف للمنتج
 */
function getItemCostFromPurchases(itemName, saleDate) {
    // البحث في purchase_items عن آخر سعر شراء لهذا المنتج قبل تاريخ البيع
    const row = db.prepare(`
        SELECT pi.unit_price, pi.unit, pi.base_quantity, pi.base_unit
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id
        WHERE pi.item_name = ?
          AND date(p.purchase_date) <= date(?)
          AND p.status != 'cancelled'
        ORDER BY p.purchase_date DESC
        LIMIT 1
    `).get(itemName, saleDate);
    
    return row || null;
}

/**
 * حساب تكلفة البضاعة المباعة لعنصر واحد
 * مع مراعاة تحويل الوحدات (طن/شيكارة)
 */
function calculateItemCOGS(saleItem, costRecord) {
    if (!costRecord) return null;
    
    const { quantity, unit } = saleItem;
    let costPerUnit = costRecord.unit_price;
    const costUnit = costRecord.base_unit || costRecord.unit;
    const saleUnit = unit;
    
    // تحويل الوحدات إذا كانت مختلفة
    // مثال: إذا اشترينا بالطن وبعنا بالشيكارة
    if (costUnit && saleUnit && costUnit !== saleUnit) {
        // البحث عن معامل التحويل من جدول inventory_items
        const convRow = db.prepare(`
            SELECT conversion_factor, unit, secondary_unit 
            FROM inventory_items 
            WHERE name = ?
            LIMIT 1
        `).get(saleItem.item_name);
        
        if (convRow && convRow.conversion_factor > 0) {
            // تحويل: إذا التكلفة بالطن والبيع بالشيكارة
            if (costUnit === convRow.unit && saleUnit === convRow.secondary_unit) {
                // cost per secondary_unit = cost_per_unit / conversion_factor
                costPerUnit = costRecord.unit_price / convRow.conversion_factor;
            } else if (costUnit === convRow.secondary_unit && saleUnit === convRow.unit) {
                // cost per primary_unit = cost_per_secondary * conversion_factor
                costPerUnit = costRecord.unit_price * convRow.conversion_factor;
            }
        }
    }
    
    return {
        costPerUnit,
        totalCost: quantity * costPerUnit,
        costUnit: saleUnit,
        hasValidCost: true
    };
}

/**
 * GET /api/reports/profit
 * Parameters: start_date, end_date, period
 */
function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

exports.getProfitReport = (req, res) => {
    try {
        let { start_date, end_date, period } = req.query;
        
        // حساب التواريخ حسب الفترة المختارة
        if (period && !start_date && !end_date) {
            const today = new Date();
            
            if (period === 'today') {
                start_date = getLocalDateString(today);
                end_date = start_date;
            } else if (period === 'week') {
                const dayOfWeek = today.getDay();
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - dayOfWeek);
                start_date = getLocalDateString(startOfWeek);
                end_date = getLocalDateString(today);
            } else if (period === 'month') {
                start_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
                end_date = getLocalDateString(today);
            } else if (period === 'year') {
                start_date = `${today.getFullYear()}-01-01`;
                end_date = getLocalDateString(today);
            }
        }

        // =============================================
        // 1. جلب فواتير البيع (بدون الملغاة)
        // =============================================
        let salesQuery = `
            SELECT 
                s.id,
                s.invoice_number,
                s.original_amount,
                s.paid_amount,
                s.remaining_amount,
                s.zara_amount,
                s.sale_date,
                s.sale_type,
                s.status,
                c.name as customer_name,
                CASE 
                    WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
                    WHEN s.remaining_amount <= 0 THEN 'PAID'
                    WHEN s.remaining_amount > 0 AND s.paid_amount > 0 THEN 'PARTIALLY_PAID'
                    WHEN s.sale_type = 'cash' THEN 'PAID'
                    ELSE 'CONFIRMED'
                END as computed_status
            FROM credit_sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.status != 'CANCELLED'
        `;
        
        const salesParams = [];
        if (start_date) { salesQuery += ` AND date(s.sale_date) >= date(?)`; salesParams.push(start_date); }
        if (end_date) { salesQuery += ` AND date(s.sale_date) <= date(?)`; salesParams.push(end_date); }
        salesQuery += ` ORDER BY s.sale_date DESC`;
        
        const sales = db.prepare(salesQuery).all(...salesParams);

        // =============================================
        // 2. حساب إجماليات المبيعات
        // =============================================
        const totalSales = sales.reduce((sum, s) => sum + (s.original_amount || 0), 0);
        const totalPaid = sales.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
        const totalOutstanding = sales.reduce((sum, s) => sum + (s.remaining_amount || 0), 0);
        let totalZaraQuery = "SELECT COALESCE(SUM(amount), 0) as total FROM customer_adjustments WHERE type = 'ZARA'";
        const totalZaraParams = [];
        if (start_date) { totalZaraQuery += ' AND date(adjustment_date) >= date(?)'; totalZaraParams.push(start_date); }
        if (end_date) { totalZaraQuery += ' AND date(adjustment_date) <= date(?)'; totalZaraParams.push(end_date); }
        const zaraAdjTotal = db.prepare(totalZaraQuery).get(...totalZaraParams)?.total || 0;
        const totalZara = Math.max(sales.reduce((sum, s) => sum + (s.zara_amount || 0), 0), zaraAdjTotal);
        const invoiceCount = sales.length;
        
        // =============================================
        // 3. حساب تكلفة البضاعة المباعة (COGS)
        // =============================================
                let totalCOGS = 0;
        let totalProductSales = 0;
        let totalServiceSales = 0;
        let totalProductCOGS = 0;
        let totalServiceCOGS = 0;
        let itemsWithNoCost = 0;
        const saleDetails = [];
        
        for (const sale of sales) {
            // جلب عناصر الفاتورة
            const saleItems = db.prepare(`
                SELECT id, item_type, service_id, item_name, quantity, unit, unit_price, total_price
                FROM credit_sale_items
                WHERE credit_sale_id = ?
            `).all(sale.id);
            
            const itemDetails = [];
            let saleTotalCost = 0;
            let saleHasMissingCost = false;
            
            for (const item of saleItems) {
                if (item.item_type === 'service') {
                    const service = db.prepare('SELECT cost_price FROM services WHERE id = ?').get(item.service_id);
                    const costPerUnit = service ? (service.cost_price || 0) : 0;
                    const itemCost = item.quantity * costPerUnit;
                                        saleTotalCost += itemCost;
                    if (item.item_type === 'service') {
                        totalServiceSales += item.total_price;
                        totalServiceCOGS += itemCost;
                    } else {
                        totalProductSales += item.total_price;
                        totalProductCOGS += itemCost;
                    }
                    totalCOGS += itemCost;
                    
                    itemDetails.push({
                        item_name: item.item_name,
                        item_type: 'service',
                        quantity: item.quantity,
                        unit: item.unit,
                        selling_price: item.unit_price,
                        selling_total: item.total_price,
                        cost_price: costPerUnit,
                        cost_total: itemCost,
                        item_profit: item.total_price - itemCost,
                        has_cost: true
                    });
                    continue;
                }
                // جلب سعر التكلفة الحقيقي
                const costRecord = getItemCostFromPurchases(item.item_name, sale.sale_date);
                
                if (costRecord) {
                    const cogsCalc = calculateItemCOGS(item, costRecord);
                    if (cogsCalc && cogsCalc.hasValidCost) {
                        const itemCost = cogsCalc.totalCost;
                                            saleTotalCost += itemCost;
                    if (item.item_type === 'service') {
                        totalServiceSales += item.total_price;
                        totalServiceCOGS += itemCost;
                    } else {
                        totalProductSales += item.total_price;
                        totalProductCOGS += itemCost;
                    }
                        totalCOGS += itemCost;
                        
                        itemDetails.push({
                            item_name: item.item_name,
                            quantity: item.quantity,
                            unit: item.unit,
                            selling_price: item.unit_price,
                            selling_total: item.total_price,
                            cost_price: cogsCalc.costPerUnit,
                            cost_total: itemCost,
                            item_profit: item.total_price - itemCost,
                            has_cost: true
                        });
                    } else {
                        saleHasMissingCost = true;
                        itemsWithNoCost++;
                        itemDetails.push({
                            item_name: item.item_name,
                            quantity: item.quantity,
                            unit: item.unit,
                            selling_price: item.unit_price,
                            selling_total: item.total_price,
                            cost_price: null,
                            cost_total: null,
                            item_profit: null,
                            has_cost: false,
                            note: 'تكلفة الشراء غير متوفرة'
                        });
                    }
                } else {
                    saleHasMissingCost = true;
                    itemsWithNoCost++;
                    itemDetails.push({
                        item_name: item.item_name,
                        quantity: item.quantity,
                        unit: item.unit,
                        selling_price: item.unit_price,
                        selling_total: item.total_price,
                        cost_price: null,
                        cost_total: null,
                        item_profit: null,
                        has_cost: false,
                        note: 'تكلفة الشراء غير متوفرة'
                    });
                }
            }
            
            saleDetails.push({
                sale_id: sale.id,
                invoice_number: sale.invoice_number || sale.id,
                customer_name: sale.customer_name,
                sale_date: sale.sale_date,
                sale_type: sale.sale_type,
                computed_status: sale.computed_status,
                total_selling: sale.original_amount,
                total_cost: saleTotalCost,
                gross_profit: saleHasMissingCost ? null : (sale.original_amount - saleTotalCost),
                has_missing_cost: saleHasMissingCost,
                items: itemDetails
            });
        }

        // =============================================
        // 4. جلب المصروفات الحقيقية
        // =============================================
        
        // مصروفات المركبات
        let expensesQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'active'`;
        const expParams = [];
        if (start_date) { expensesQuery += ` AND date(expense_date) >= date(?)`; expParams.push(start_date); }
        if (end_date) { expensesQuery += ` AND date(expense_date) <= date(?)`; expParams.push(end_date); }
        const vehicleExpenses = db.prepare(expensesQuery).get(...expParams).total;
        
        // مسحوبات العمال
        let workerQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM worker_withdrawals WHERE status = 'active'`;
        const workerParams = [];
        if (start_date) { workerQuery += ` AND date(withdrawal_date) >= date(?)`; workerParams.push(start_date); }
        if (end_date) { workerQuery += ` AND date(withdrawal_date) <= date(?)`; workerParams.push(end_date); }
        const workerWithdrawals = db.prepare(workerQuery).get(...workerParams).total;
        
        // مصروفات أخرى
        let otherQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM other_expenses WHERE status = 'active'`;
        const otherParams = [];
        if (start_date) { otherQuery += ` AND date(expense_date) >= date(?)`; otherParams.push(start_date); }
        if (end_date) { otherQuery += ` AND date(expense_date) <= date(?)`; otherParams.push(end_date); }
        const otherExpenses = db.prepare(otherQuery).get(...otherParams).total;
        
        const totalExpenses = vehicleExpenses + workerWithdrawals + otherExpenses;

        // =============================================
        // 5. حساب الأرباح
        // =============================================
        const grossProfit = totalSales - totalCOGS;
        const netProfit = grossProfit - totalExpenses - totalZara;

        // =============================================
        // 6. تفاصيل المصروفات للعرض
        // =============================================
        let expDetailQuery = `
            SELECT 'مصروفات مركبات' as category, expense_type as name, vehicle, amount, expense_date as date, description
            FROM expenses WHERE status = 'active'
        `;
        const expDetailParams = [];
        if (start_date) { expDetailQuery += ` AND date(expense_date) >= date(?)`; expDetailParams.push(start_date); }
        if (end_date) { expDetailQuery += ` AND date(expense_date) <= date(?)`; expDetailParams.push(end_date); }

        let workerDetailQuery = `
            SELECT 'مسحوبات عمال' as category, w.name, '' as vehicle, wd.amount, wd.withdrawal_date as date, wd.description
            FROM worker_withdrawals wd JOIN workers w ON wd.worker_id = w.id
            WHERE wd.status = 'active'
        `;
        const workerDetailParams = [];
        if (start_date) { workerDetailQuery += ` AND date(wd.withdrawal_date) >= date(?)`; workerDetailParams.push(start_date); }
        if (end_date) { workerDetailQuery += ` AND date(wd.withdrawal_date) <= date(?)`; workerDetailParams.push(end_date); }

        let otherDetailQuery = `
            SELECT 'مصروفات أخرى' as category, expense_name as name, '' as vehicle, amount, expense_date as date, description
            FROM other_expenses WHERE status = 'active'
        `;
        const otherDetailParams = [];
        if (start_date) { otherDetailQuery += ` AND date(expense_date) >= date(?)`; otherDetailParams.push(start_date); }
        if (end_date) { otherDetailQuery += ` AND date(expense_date) <= date(?)`; otherDetailParams.push(end_date); }

        const expenseDetails = [
            ...db.prepare(expDetailQuery).all(...expDetailParams),
            ...db.prepare(workerDetailQuery).all(...workerDetailParams),
            ...db.prepare(otherDetailQuery).all(...otherDetailParams)
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        // =============================================
        // 7. تفاصيل التصفية اليومية (Daily Closing)
        // =============================================
        const closingDate = start_date || end_date;
        let dailyClosing = null;
        
        if (period === 'today' || (start_date && start_date === end_date)) {
            // تحصيلات العملاء النقدية
            const cashCollectionsQ = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total 
                FROM customer_payments 
                WHERE date(payment_date) = date(?)
            `).get(closingDate || start_date);
            
            // مبيعات نقدية
            const cashSalesQ = db.prepare(`
                SELECT COALESCE(SUM(original_amount), 0) as total 
                FROM credit_sales 
                WHERE sale_type = 'cash' AND status != 'CANCELLED' AND date(sale_date) = date(?)
            `).get(closingDate || start_date);
            
            // مبيعات آجلة
            const creditSalesQ = db.prepare(`
                SELECT COALESCE(SUM(original_amount), 0) as total 
                FROM credit_sales 
                WHERE sale_type != 'cash' AND status != 'CANCELLED' AND date(sale_date) = date(?)
            `).get(closingDate || start_date);
            
            // دفعيات الموردين
            const supplierPayQ = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total 
                FROM supplier_balance_transactions 
                WHERE transaction_type = 'deposit' AND date(created_at) = date(?)
            `).get(closingDate || start_date);
            
            dailyClosing = {
                date: closingDate || start_date,
                total_sales: (cashSalesQ?.total || 0) + (creditSalesQ?.total || 0),
                cash_sales: cashSalesQ?.total || 0,
                credit_sales: creditSalesQ?.total || 0,
                customer_collections: cashCollectionsQ?.total || 0,
                total_expenses: totalExpenses,
                supplier_payments: supplierPayQ?.total || 0,
                gross_profit: grossProfit,
                net_profit: netProfit,
                expense_breakdown: {
                    vehicle_expenses: vehicleExpenses,
                    worker_withdrawals: workerWithdrawals,
                    other_expenses: otherExpenses
                }
            };
        }

        // الاستجابة النهائية
        res.json({
            period: { start_date, end_date },
            summary: {
                totalSales,
                totalPaid,
                totalOutstanding,
                totalZara,
                invoiceCount,
                                totalProductSales,
                totalServiceSales,
                totalProductCOGS,
                totalServiceCOGS,
                productProfit: totalProductSales - totalProductCOGS,
                serviceProfit: totalServiceSales - totalServiceCOGS,
                totalCOGS,
                grossProfit,
                totalExpenses,
                netProfit,
                itemsWithNoCost,
                expenseBreakdown: {
                    vehicleExpenses,
                    workerWithdrawals,
                    otherExpenses
                }
            },
            saleDetails,
            expenseDetails,
            dailyClosing
        });

    } catch (error) {
        console.error('Profit calculation error:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حساب الأرباح: ' + error.message });
    }
};




