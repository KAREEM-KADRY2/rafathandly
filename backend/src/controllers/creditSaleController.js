const db = require('../db');
const auditLogger = require('./auditLogger');
const treasuryController = require('./treasuryController');
const periodsController = require('./periodsController');
const purchaseAllocationService = require('../services/purchaseAllocationService');

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

exports.getGroupedSales = (req, res) => {
    try {
        const { dateFrom, dateTo, filterType, filterStatus } = req.query;
        
        let baseQuery = `FROM credit_sales s JOIN customers c ON s.customer_id = c.id WHERE 1=1`;
        const params = [];

        if (dateFrom) { baseQuery += ' AND date(s.sale_date) >= date(?)'; params.push(dateFrom); }
        if (dateTo) { baseQuery += ' AND date(s.sale_date) <= date(?)'; params.push(dateTo); }
        if (filterType) { baseQuery += ' AND s.sale_type = ?'; params.push(filterType); }

        const query = `
            WITH ComputedSales AS (
                SELECT s.*, c.name as customer_name, c.phone as customer_phone,
                       CASE 
                           WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
                           WHEN s.remaining_amount <= 0 THEN 'PAID'
                           WHEN s.remaining_amount > 0 AND date('now', '+3 hours') > date(s.due_date) THEN 'OVERDUE'
                           WHEN s.remaining_amount > 0 AND s.paid_amount > 0 THEN 'PARTIALLY_PAID'
                           WHEN s.sale_type = 'cash' THEN 'PAID'
                           ELSE 'CONFIRMED'
                       END as computed_status
                ${baseQuery}
            )
            SELECT 
                customer_id,
                MAX(customer_name) as customer_name,
                MAX(customer_phone) as customer_phone,
                COUNT(id) as transactions_count,
                COALESCE(SUM(original_amount), 0) as total_sales,
                COALESCE(SUM(CASE WHEN sale_type = 'cash' THEN original_amount ELSE 0 END), 0) as total_cash_sales,
                COALESCE(SUM(CASE WHEN sale_type != 'cash' THEN original_amount ELSE 0 END), 0) as total_credit_sales,
                COALESCE(SUM(paid_amount), 0) as total_paid,
                COALESCE(SUM(remaining_amount), 0) as total_remaining
            FROM ComputedSales
            ${filterStatus ? `WHERE computed_status = ?` : ''}
            GROUP BY customer_id
            ORDER BY customer_name ASC
        `;
        
        if (filterStatus) params.push(filterStatus);

        const grouped = db.prepare(query).all(...params);
        res.json(grouped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllSales = (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT s.*, c.name as customer_name,
                   CASE 
                       WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
                       WHEN s.remaining_amount <= 0 THEN 'PAID'
                       WHEN s.remaining_amount > 0 AND date('now', '+3 hours') > date(s.due_date) THEN 'OVERDUE'
                       WHEN s.remaining_amount > 0 AND s.paid_amount > 0 THEN 'PARTIALLY_PAID'
                       WHEN s.sale_type = 'cash' THEN 'PAID'
                       ELSE 'CONFIRMED'
                   END as computed_status
            FROM credit_sales s
            JOIN customers c ON s.customer_id = c.id
            ORDER BY s.sale_date DESC, s.created_at DESC
        `);
        const sales = stmt.all();

        // Calculate average costs
        const avgCosts = {};
        const purchases = db.prepare('SELECT item_name, SUM(total_price) as total_price, SUM(quantity) as total_quantity FROM purchase_items GROUP BY item_name').all();
        purchases.forEach(p => {
            avgCosts[p.item_name] = p.total_quantity > 0 ? (p.total_price / p.total_quantity) : 0;
        });

        // Inventory mapping for unit conversions
        const invItems = db.prepare('SELECT name, unit, secondary_unit, conversion_factor, conversion_operator FROM inventory_items').all();
        const invMap = {};
        invItems.forEach(i => invMap[i.name.trim()] = i);

        // Calculate total cost per sale
        const allSaleItems = db.prepare('SELECT credit_sale_id, item_name, quantity, unit FROM credit_sale_items').all();
        const saleCosts = {};
        
        allSaleItems.forEach(item => {
            let normalizedQty = item.quantity;
            const inv = invMap[item.item_name?.trim()];
            if (inv && inv.secondary_unit && inv.conversion_factor && item.unit === inv.secondary_unit) {
                normalizedQty = item.quantity / inv.conversion_factor;
            }
            const costPerUnit = avgCosts[item.item_name] || 0;
            const itemCost = normalizedQty * costPerUnit;
            saleCosts[item.credit_sale_id] = (saleCosts[item.credit_sale_id] || 0) + itemCost;
        });
        
        const itemCounts = {};
        allSaleItems.forEach(item => {
            itemCounts[item.credit_sale_id] = (itemCounts[item.credit_sale_id] || 0) + 1;
        });

        sales.forEach(s => {
            s.total_cost = saleCosts[s.id] || 0;
            s.net_profit = s.original_amount - s.total_cost;
            s.items_count = itemCounts[s.id] || 0;
        });

        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCustomerCreditSales = (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare(`
            SELECT s.*,
                   CASE 
                       WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
                       WHEN s.remaining_amount <= 0 THEN 'PAID'
                       WHEN s.remaining_amount > 0 AND date('now', '+3 hours') > date(s.due_date) THEN 'OVERDUE'
                       WHEN s.remaining_amount > 0 AND s.paid_amount > 0 THEN 'PARTIALLY_PAID'
                       WHEN s.sale_type = 'cash' THEN 'PAID'
                       ELSE 'CONFIRMED'
                   END as computed_status
            FROM credit_sales s
            WHERE s.customer_id = ?
            ORDER BY s.sale_date DESC
        `);
        const sales = stmt.all(id);
        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCreditSaleById = (req, res) => {
    try {
        const { id } = req.params;
        
        const saleStmt = db.prepare(`
            SELECT s.*,
                   CASE 
                       WHEN s.status = 'CANCELLED' THEN 'CANCELLED'
                       WHEN s.remaining_amount <= 0 THEN 'PAID'
                       WHEN s.remaining_amount > 0 AND date('now', '+3 hours') > date(s.due_date) THEN 'OVERDUE'
                       WHEN s.remaining_amount > 0 AND s.paid_amount > 0 THEN 'PARTIALLY_PAID'
                       WHEN s.sale_type = 'cash' THEN 'PAID'
                       ELSE 'CONFIRMED'
                   END as computed_status,
                   c.name as customer_name,
                   c.phone as customer_phone
            FROM credit_sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.id = ?
        `);
        const sale = saleStmt.get(id);
        
        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        
        const itemsStmt = db.prepare('SELECT * FROM credit_sale_items WHERE credit_sale_id = ?');
        const items = itemsStmt.all(id);
        let total_cost = 0;
        const avgCosts = {};
        const purchases = db.prepare('SELECT item_name, SUM(total_price) as total_price, SUM(quantity) as total_quantity FROM purchase_items GROUP BY item_name').all();
        purchases.forEach(p => {
            avgCosts[p.item_name] = p.total_quantity > 0 ? (p.total_price / p.total_quantity) : 0;
        });
        const invItems = db.prepare('SELECT name, unit, secondary_unit, conversion_factor, conversion_operator FROM inventory_items').all();
        const invMap = {};
        invItems.forEach(i => invMap[i.name] = i);
        items.forEach(item => {
            let normalizedQty = item.quantity;
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
                    normalizedQty = op === '*' ? item.quantity * factor : item.quantity / factor;
                    const cleanBase = Math.round(normalizedQty * 10000) / 10000;
                    equivText = cleanBase + ' ' + inv.unit;
                } else if (normUnit === normBase || item.unit === inv.unit) {
                    const secQty = op === '*' ? item.quantity / factor : item.quantity * factor;
                    const cleanSec = Math.round(secQty * 10000) / 10000;
                    equivText = cleanSec + ' ' + inv.secondary_unit;
                }
            }
            item.normalized_quantity = Math.round(normalizedQty * 10000) / 10000;
            item.equivalent_text = equivText;

            const costPerUnit = avgCosts[item.item_name] || 0;
            item.item_cost = normalizedQty * costPerUnit;
            item.item_profit = item.total_price - item.item_cost;
            total_cost += item.item_cost;

            try {
                item.allocations = purchaseAllocationService.getSaleItemAllocations(item.id, db) || [];
            } catch (e) {
                item.allocations = [];
            }
        });
        sale.total_cost = total_cost;
        sale.net_profit = sale.original_amount - total_cost;

        
        const paymentsStmt = db.prepare(`
            SELECT cp.*, fa.name as account_name
            FROM customer_payments cp
            LEFT JOIN financial_accounts fa ON cp.account_id = fa.id
            WHERE cp.credit_sale_id = ?
            ORDER BY cp.payment_date DESC, cp.id DESC
        `);
        const payments = paymentsStmt.all(id);

        // Get customer's opening balance if registered
        const obRow = db.prepare("SELECT balance_type, amount, effective_date, notes FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?").get(sale.customer_id);
        const opening_balance = obRow ? {
            amount: Number(obRow.amount) || 0,
            balance_type: obRow.balance_type || 'debit',
            effective_date: obRow.effective_date,
            notes: obRow.notes
        } : null;
        const obAmount = opening_balance ? (opening_balance.balance_type === 'debit' ? opening_balance.amount : -opening_balance.amount) : 0;

        // Accurate historical previous balance prior to this sale:
        const prevSalesRow = db.prepare(`
            SELECT COALESCE(SUM(original_amount - COALESCE(zara_amount, 0)), 0) as val
            FROM credit_sales
            WHERE customer_id = ? AND status != 'CANCELLED' 
              AND (datetime(sale_date) < datetime(?) OR (datetime(sale_date) = datetime(?) AND id < ?))
        `).get(sale.customer_id, sale.sale_date, sale.sale_date, sale.id);

        const prevPaymentsRow = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as val
            FROM customer_payments
            WHERE customer_id = ? AND (datetime(payment_date) < datetime(?) OR (datetime(payment_date) = datetime(?) AND credit_sale_id IS NOT NULL AND credit_sale_id < ?))
        `).get(sale.customer_id, sale.sale_date, sale.sale_date, sale.id);

        const prevAdjustmentsRow = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as val
            FROM customer_adjustments
            WHERE customer_id = ? AND datetime(created_at) < datetime(?)
        `).get(sale.customer_id, sale.sale_date);

        const calculatedPrevBalance = obAmount + (prevSalesRow?.val || 0) - (prevPaymentsRow?.val || 0) - (prevAdjustmentsRow?.val || 0);

        // Current overall customer balance across all operations
        const currentBalStmt = db.prepare(`
            SELECT 
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) +
                COALESCE((SELECT SUM(original_amount - COALESCE(zara_amount, 0)) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = ?), 0)
            AS total_due
        `);
        const current_customer_balance = currentBalStmt.get(sale.customer_id, sale.customer_id, sale.customer_id, sale.customer_id).total_due;

        const previous_customer_balance = calculatedPrevBalance;
        
        res.json({ ...sale, items, payments, previous_customer_balance, current_customer_balance, opening_balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createCreditSale = (req, res) => {
    let { customer_id, customer_name, invoice_number, items, sale_date, sale_type, credit_deadline, paid_amount, notes, account_id, payment_method } = req.body;
    
    // Normalize customer name and handle direct typing / walk-in cash customer
    const trimmedCustomerName = (customer_name || '').trim();
    if (!customer_id && trimmedCustomerName) {
        // Search if customer exists with this name (case-insensitive)
        const existing = db.prepare('SELECT id, default_credit_deadline FROM customers WHERE LOWER(TRIM(name)) = LOWER(?)').get(trimmedCustomerName);
        if (existing) {
            customer_id = existing.id;
        } else {
            // Auto-create customer
            const ins = db.prepare('INSERT INTO customers (name, default_credit_deadline, notes) VALUES (?, ?, ?)');
            const insRes = ins.run(
                trimmedCustomerName, 
                sale_type === 'cash' ? 0 : (parseInt(credit_deadline) || 3), 
                sale_type === 'cash' ? 'عميل نقدي' : 'عميل تم إنشاؤه مع الفاتورة'
            );
            customer_id = insRes.lastInsertRowid;
        }
    } else if (!customer_id && sale_type === 'cash') {
        const existingCash = db.prepare("SELECT id FROM customers WHERE LOWER(TRIM(name)) = 'عميل نقدي'").get();
        if (existingCash) {
            customer_id = existingCash.id;
        } else {
            const ins = db.prepare('INSERT INTO customers (name, default_credit_deadline, notes) VALUES (?, ?, ?)');
            const insRes = ins.run('عميل نقدي', 0, 'عميل نقدي افتراضي');
            customer_id = insRes.lastInsertRowid;
        }
    }

    if (!customer_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'بيانات الفاتورة غير مكتملة: يرجى تحديد العميل وإضافة الأصناف' });
    }

    const transaction = db.transaction(() => {
        // Calculate totals dynamically from items to avoid frontend tampering
        let original_amount = 0;
        for (const item of items) {
            if (item.quantity <= 0 || item.unit_price < 0) {
                throw new Error('كميات أو أسعار غير صحيحة');
            }
            original_amount += parseFloat(item.quantity) * parseFloat(item.unit_price);
        }

        const isCash = (sale_type === 'cash');
        const actualPaidAmount = isCash ? original_amount : (parseFloat(paid_amount) || 0);
        
        if (actualPaidAmount < 0 || actualPaidAmount > original_amount) {
            throw new Error('قيمة المدفوع غير صحيحة');
        }
        
        const remaining_amount = original_amount - actualPaidAmount;
        const finalStatus = remaining_amount === 0 ? 'PAID' : 'CONFIRMED';
        const finalDeadline = isCash ? 0 : parseInt(credit_deadline) || 0;

        // Calculate due date
        const saleDateObj = new Date(sale_date);
        saleDateObj.setDate(saleDateObj.getDate() + finalDeadline);
        const due_date = saleDateObj.toISOString().split('T')[0];

        const saleStmt = db.prepare(`
            INSERT INTO credit_sales (customer_id, invoice_number, original_amount, paid_amount, remaining_amount, sale_date, credit_deadline, due_date, sale_type, status, notes, period_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = saleStmt.run(
            customer_id, 
            invoice_number || null, 
            original_amount, 
            actualPaidAmount,
            remaining_amount, 
            sale_date, 
            finalDeadline, 
            due_date, 
            sale_type || 'credit',
            finalStatus,
            notes || null,
            periodsController.getActivePeriodId()
        );
        const saleId = result.lastInsertRowid;

        // Auto-assign ID as invoice number if empty
        if (!invoice_number) {
            db.prepare('UPDATE credit_sales SET invoice_number = ? WHERE id = ?').run(saleId.toString(), saleId);
        }

        const itemStmt = db.prepare(`
            INSERT INTO credit_sale_items (credit_sale_id, item_type, service_id, item_name, quantity, unit, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const findInventoryItem = db.prepare('SELECT id FROM inventory_items WHERE name = ?');
        const getStock = db.prepare(`
            SELECT 
                COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = ? AND movement_type IN ('IN', 'ADJUST_IN')), 0) -
                COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE item_id = ? AND movement_type IN ('OUT', 'ADJUST_OUT')), 0) as current_stock
        `);
        const insertInventoryMovement = db.prepare(`
            INSERT INTO inventory_movements (item_id, movement_type, quantity, unit, original_quantity, original_unit, reference_type, reference_id, customer_id, movement_date)
            VALUES (?, 'OUT', ?, ?, ?, ?, 'SALE', ?, ?, ?)
        `);

        for (const item of items) {
            const itemTotal = parseFloat(item.quantity) * parseFloat(item.unit_price);
            const isService = item.item_type === 'service';
            const itemRes = itemStmt.run(saleId, item.item_type || 'product', item.service_id || null, item.item_name, item.quantity, item.unit, item.unit_price, itemTotal);
            if (!isService) {
                purchaseAllocationService.allocateSaleItemToPurchaseStock(itemRes.lastInsertRowid, db);
            }
            
            // Upsert customer specific price
            if (!isService && item.item_name && item.unit && item.unit_price > 0) {
                db.prepare(`
                    INSERT INTO customer_item_prices (customer_id, item_name, unit, price)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(customer_id, item_name, unit) DO UPDATE SET price = excluded.price
                `).run(customer_id, item.item_name, item.unit, item.unit_price);
            }

            if (!isService) {
            
            // Find inventory item
            const allInv = db.prepare('SELECT id, name, unit, secondary_unit, conversion_factor, conversion_operator FROM inventory_items').all();
            const normItemName = normalizeArabic(item.item_name);
            
            // 1. Exact match first
            let inventoryItem = allInv.find(i => i.name.trim() === item.item_name.trim());
            // 2. Normalized match prioritizing items with available stock
            if (!inventoryItem) {
                const matchingInv = allInv.filter(i => normalizeArabic(i.name) === normItemName);
                if (matchingInv.length === 1) {
                    inventoryItem = matchingInv[0];
                } else if (matchingInv.length > 1) {
                    inventoryItem = matchingInv.find(inv => {
                        const st = getStock.get(inv.id, inv.id);
                        return st && st.current_stock > 0;
                    }) || matchingInv[0];
                }
            }
            // 3. If exact match has 0 stock but an alias with stock exists, use the one with stock
            if (inventoryItem) {
                const currStock = getStock.get(inventoryItem.id, inventoryItem.id)?.current_stock || 0;
                if (currStock <= 0) {
                    const aliasWithStock = allInv.find(i => normalizeArabic(i.name) === normItemName && (getStock.get(i.id, i.id)?.current_stock || 0) > 0);
                    if (aliasWithStock) {
                        inventoryItem = aliasWithStock;
                    }
                }
            }

            if (!inventoryItem) {
                throw new Error(`الصنف '${item.item_name}' غير موجود في المخزن`);
            }
            
            // Normalize quantity for warehouse
            let normalizedQuantity = parseFloat(item.quantity);
            const normUnit = normalizeArabic(item.unit);
            const normSec = normalizeArabic(inventoryItem.secondary_unit);
            const isSec = (normUnit === normSec || item.unit === inventoryItem.secondary_unit);
            if (isSec && inventoryItem.conversion_factor) {
                const factor = parseFloat(inventoryItem.conversion_factor);
                normalizedQuantity = parseFloat(item.quantity) / factor;
            } else if (item.unit !== inventoryItem.unit) {
                // If it doesn't match base or secondary, we just assume they entered it wrong or fallback to raw
                console.warn(`Unrecognized unit '${item.unit}' for item '${item.item_name}'`);
            }
            
            const stockRes = getStock.get(inventoryItem.id, inventoryItem.id);
            if (stockRes.current_stock < normalizedQuantity) {
                throw new Error(`الكمية المطلوبة غير متوفرة في المخزن. المتاح حاليًا من '${item.item_name}': ${stockRes.current_stock} ${inventoryItem.unit}`);
            }
            
            insertInventoryMovement.run(
                inventoryItem.id,
                normalizedQuantity,
                inventoryItem.unit, // Store in base unit
                parseFloat(item.quantity), // Store original quantity
                item.unit, // Store original unit
                saleId,
                customer_id,
                sale_date
            );
            }
        }

        // Current balance for transaction log
        const balanceStmt = db.prepare(`SELECT COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) + COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) as balance`);
        let currentBalance = balanceStmt.get(customer_id, customer_id).balance;

        // Log Sale Transaction (Debt increase by remaining_amount, NOT original_amount. Because if it's cash, there is no debt increase. 
        // Wait, accounting standard: Sale increases debt by original, Payment decreases by paid. Let's do both to be explicit).
        const logStmt = db.prepare(`
            INSERT INTO customer_account_transactions (customer_id, credit_sale_id, transaction_type, amount, balance_after, transaction_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Log Sale
        // We log the original amount as SALE
        logStmt.run(customer_id, saleId, 'SALE', original_amount, currentBalance, sale_date, `فاتورة بيع ${isCash ? 'نقدي' : 'آجل'} رقم ${invoice_number || saleId}`);
        
        // If there is a payment (either cash or upfront credit payment)
        if (actualPaidAmount > 0) {
            let chosenAccountId = account_id ? Number(account_id) : null;
            if (!chosenAccountId) {
                const defAcc = db.prepare("SELECT id FROM financial_accounts WHERE type = 'CASH' LIMIT 1").get();
                chosenAccountId = defAcc ? defAcc.id : 1;
            }

            const accRow = db.prepare('SELECT name FROM financial_accounts WHERE id = ?').get(chosenAccountId);
            const accName = accRow ? accRow.name : 'النقدي';

            const payStmt = db.prepare(`
                INSERT INTO customer_payments (customer_id, credit_sale_id, amount, payment_date, payment_method, notes, recorded_by, account_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const payResult = payStmt.run(
                customer_id, 
                saleId, 
                actualPaidAmount, 
                sale_date, 
                payment_method || (accName || (isCash ? 'نقدي' : 'نقدًا')), 
                `دفعة مع الفاتورة رقم ${invoice_number || saleId}`, 
                'Admin',
                chosenAccountId
            );
            
            // Recalculate balance for the log (it decreased by actualPaidAmount)
            currentBalance = balanceStmt.get(customer_id, customer_id).balance;
            
            logStmt.run(
                customer_id, 
                saleId, 
                'PAYMENT', 
                -actualPaidAmount, 
                currentBalance, 
                sale_date, 
                `سداد مبدئي/نقدي للفاتورة رقم ${invoice_number || saleId}`
            );

            const custRow = db.prepare('SELECT name FROM customers WHERE id = ?').get(customer_id);
            const custName = custRow ? custRow.name : (trimmedCustomerName || 'عميل نقدي');
            
            treasuryController.recordTransaction({
                account_id: chosenAccountId,
                type: 'receipt',
                party_type: 'customer',
                party_id: customer_id,
                party_name: custName,
                amount: actualPaidAmount,
                payment_method: payment_method || accName || 'نقدي',
                description: `تحصيل فاتورة بيع ${isCash ? 'نقدي' : 'آجل'} رقم ${invoice_number || saleId} - ${custName}`,
                reference_type: 'CUSTOMER_PAYMENT',
                reference_id: payResult.lastInsertRowid,
                transaction_date: sale_date
            });
        }

        return saleId;
    });

    try {
        const saleId = transaction();
        try {
            treasuryController.reallocateCustomerSales(customer_id);
        } catch (e) {}
        auditLogger.logAction(req.body.recorded_by || 'مستخدم النظام', 'إنشاء فاتورة مبيعات', 'المبيعات', 'فاتورة مبيعات', saleId, `فاتورة مبيعات للعميل بقيمة ${req.body.items.reduce((acc, item) => acc + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)), 0)}`);
        res.status(201).json({ id: saleId, message: 'تم إنشاء فاتورة المبيعات بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.addPayment = (req, res) => {
    const { id: credit_sale_id } = req.params;
    const { amount, payment_date, payment_method, reference_number, notes, recorded_by, account_id } = req.body;
    
    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) return res.status(400).json({ error: 'قيمة التحصيل يجب أن تكون أكبر من صفر' });

    const transaction = db.transaction(() => {
        // Lock/get current sale
        const saleStmt = db.prepare('SELECT * FROM credit_sales WHERE id = ?');
        const sale = saleStmt.get(credit_sale_id);
        
        if (!sale) throw new Error('الفاتورة غير موجودة');
        if (sale.status === 'CANCELLED') throw new Error('لا يمكن التحصيل لفاتورة ملغاة');
        if (paymentAmount > sale.remaining_amount) throw new Error('قيمة التحصيل أكبر من المبلغ المتبقي');

        const newPaid = sale.paid_amount + paymentAmount;
        const newRemaining = sale.remaining_amount - paymentAmount;

        // Insert payment
        const payCols = db.prepare('PRAGMA table_info(customer_payments)').all().map(c => c.name);
        let payResult;
        if (payCols.includes('account_id')) {
            const payStmt = db.prepare(`
                INSERT INTO customer_payments (customer_id, credit_sale_id, amount, payment_date, payment_method, account_id, reference_number, notes, recorded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            payResult = payStmt.run(
                sale.customer_id, 
                credit_sale_id, 
                paymentAmount, 
                payment_date, 
                payment_method || 'نقدًا', 
                account_id ? Number(account_id) : null,
                reference_number || null, 
                notes || null, 
                recorded_by || 'Admin'
            );
        } else {
            const payStmt = db.prepare(`
                INSERT INTO customer_payments (customer_id, credit_sale_id, amount, payment_date, payment_method, reference_number, notes, recorded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            payResult = payStmt.run(
                sale.customer_id, 
                credit_sale_id, 
                paymentAmount, 
                payment_date, 
                payment_method || 'نقدًا', 
                reference_number || null, 
                notes || null, 
                recorded_by || 'Admin'
            );
        }
        const paymentId = payResult.lastInsertRowid;

        // Update Sale
        const updateSaleStmt = db.prepare(`
            UPDATE credit_sales 
            SET paid_amount = ?, remaining_amount = ?, status = ?
            WHERE id = ?
        `);
        const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
        updateSaleStmt.run(newPaid, newRemaining, newStatus, credit_sale_id);

        // Current balance for transaction log
        const balanceStmt = db.prepare(`SELECT COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) + COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) as balance`);
        const currentBalance = balanceStmt.get(sale.customer_id, sale.customer_id).balance;

        // Log transaction
        const logStmt = db.prepare(`
            INSERT INTO customer_account_transactions (customer_id, credit_sale_id, payment_id, transaction_type, amount, balance_after, transaction_date, notes)
            VALUES (?, ?, ?, 'PAYMENT', ?, ?, ?, ?)
        `);
        logStmt.run(
            sale.customer_id, 
            credit_sale_id, 
            paymentId, 
            -paymentAmount, 
            currentBalance, 
            payment_date, 
            `دفعة من الفاتورة ${sale.invoice_number || credit_sale_id}`
        );
        
        const custName = db.prepare('SELECT name FROM customers WHERE id = ?').get(sale.customer_id)?.name;
        
        treasuryController.recordTransaction({
            account_id: account_id ? Number(account_id) : null,
            type: 'receipt',
            party_type: 'customer',
            party_id: sale.customer_id,
            party_name: custName,
            amount: paymentAmount,
            payment_method: payment_method || 'نقدي',
            description: `دفعة من الفاتورة ${sale.invoice_number || credit_sale_id}`,
            reference_type: 'CUSTOMER_PAYMENT',
            reference_id: paymentId,
            transaction_date: payment_date
        });

        return { paymentId, newRemaining };
    });

    try {
        const result = transaction();
        res.status(201).json({ message: 'تم تسجيل التحصيل بنجاح', ...result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.cancelSale = (req, res) => {
    const { id: credit_sale_id } = req.params;

    const transaction = db.transaction(() => {
        const saleStmt = db.prepare('SELECT * FROM credit_sales WHERE id = ?');
        const sale = saleStmt.get(credit_sale_id);

        if (!sale) throw new Error('الفاتورة غير موجودة');
        if (sale.status === 'CANCELLED') throw new Error('الفاتورة ملغاة بالفعل');

        // 1. Reverse Inventory Movements
        const insertInventoryMovement = db.prepare(`
            INSERT INTO inventory_movements (item_id, movement_type, quantity, unit, reference_type, reference_id, customer_id, movement_date, notes)
            SELECT item_id, 'ADJUST_IN', quantity, unit, 'SALE', reference_id, customer_id, datetime('now'), 'إلغاء الفاتورة رقم ' || reference_id
            FROM inventory_movements
            WHERE reference_type = 'SALE' AND reference_id = ?
        `);
        insertInventoryMovement.run(credit_sale_id);

        // 2. Reallocate / free purchase allocation
        purchaseAllocationService.reallocateSale(credit_sale_id, db);

        // 3. Revert linked payments and their treasury transactions
        const payments = db.prepare('SELECT * FROM customer_payments WHERE credit_sale_id = ?').all(credit_sale_id);
        for (const payment of payments) {
            const treasuryTxs = db.prepare(`
                SELECT * FROM treasury_transactions 
                WHERE reference_type = 'CUSTOMER_PAYMENT' AND reference_id = ?
            `).all(payment.id);

            for (const tTx of treasuryTxs) {
                if (tTx.type === 'IN') {
                    db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(tTx.amount, tTx.account_id);
                } else if (tTx.type === 'OUT') {
                    db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(tTx.amount, tTx.account_id);
                }
                db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(tTx.id);
            }
        }

        // Also check if any treasury tx referenced this sale directly
        const directTreasuryTxs = db.prepare(`
            SELECT * FROM treasury_transactions 
            WHERE reference_type IN ('SALE', 'sale', 'credit_sale') AND reference_id = ?
        `).all(credit_sale_id);
        for (const dt of directTreasuryTxs) {
            if (dt.type === 'IN') {
                db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(dt.amount, dt.account_id);
            } else if (dt.type === 'OUT') {
                db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(dt.amount, dt.account_id);
            }
            db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(dt.id);
        }

        // 4. Delete payments and adjustments linked to this sale
        db.prepare('DELETE FROM customer_payments WHERE credit_sale_id = ?').run(credit_sale_id);
        db.prepare('DELETE FROM customer_adjustments WHERE credit_sale_id = ?').run(credit_sale_id);

        // 5. Update Invoice Status
        db.prepare(`UPDATE credit_sales SET status = 'CANCELLED', remaining_amount = 0, paid_amount = 0 WHERE id = ?`).run(credit_sale_id);

        // 6. Recalculate Customer Balance accurately
        const balanceStmt = db.prepare(`
            SELECT 
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) +
                COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = ?), 0)
            AS balance
        `);
        const newBalance = balanceStmt.get(sale.customer_id, sale.customer_id, sale.customer_id, sale.customer_id).balance;

        const hasCustomerBalanceCol = db.prepare("PRAGMA table_info(customers)").all().some(c => c.name === 'balance');
        if (hasCustomerBalanceCol) {
            db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(newBalance, sale.customer_id);
        }

        // Clean up payment logs for this sale so no orphan rows remain
        db.prepare("DELETE FROM customer_account_transactions WHERE credit_sale_id = ? AND transaction_type = 'PAYMENT'").run(credit_sale_id);

        // Log transaction (reversing the sale in customer account statement)
        const logStmt = db.prepare(`
            INSERT INTO customer_account_transactions (customer_id, credit_sale_id, transaction_type, amount, balance_after, transaction_date, notes)
            VALUES (?, ?, 'SALE', ?, ?, datetime('now'), ?)
        `);
        logStmt.run(
            sale.customer_id, 
            credit_sale_id, 
            -sale.original_amount, 
            newBalance, 
            `إلغاء فاتورة مبيعات رقم ${sale.invoice_number || credit_sale_id}`
        );

        auditLogger.logAction(
            req.body?.user || req.user?.username || 'مستخدم النظام',
            'إلغاء فاتورة مبيعات',
            'المبيعات',
            'فاتورة مبيعات',
            credit_sale_id,
            `تم إلغاء الفاتورة رقم ${sale.invoice_number || credit_sale_id} بمبلغ ${sale.original_amount} وإرجاع الأصناف للمخزن وتحديث الحسابات والخزينة`
        );

        return { success: true, newBalance };
    });

    try {
        const result = transaction();
        res.json({ message: 'تم إلغاء الفاتورة وتحديث الحسابات والمخزن بنجاح', ...result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deletePayment = (req, res) => {
    const { paymentId } = req.params;

    const transaction = db.transaction(() => {
        const payment = db.prepare('SELECT * FROM customer_payments WHERE id = ?').get(paymentId);
        if (!payment) throw new Error('الدفعة غير موجودة');

        const sale = db.prepare('SELECT * FROM credit_sales WHERE id = ?').get(payment.credit_sale_id);

        // 1. Revert treasury transaction
        const treasuryTxs = db.prepare(`
            SELECT * FROM treasury_transactions 
            WHERE reference_type = 'CUSTOMER_PAYMENT' AND reference_id = ?
        `).all(paymentId);

        for (const tTx of treasuryTxs) {
            if (tTx.type === 'IN') {
                db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(tTx.amount, tTx.account_id);
            } else if (tTx.type === 'OUT') {
                db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(tTx.amount, tTx.account_id);
            }
            db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(tTx.id);
        }

        // 2. Update sale if exists
        if (sale && sale.status !== 'CANCELLED') {
            const newPaid = Math.max(0, (sale.paid_amount || 0) - payment.amount);
            const newRemaining = (sale.remaining_amount || 0) + payment.amount;
            const newStatus = newRemaining === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIALLY_PAID' : 'CONFIRMED');
            db.prepare(`
                UPDATE credit_sales 
                SET paid_amount = ?, remaining_amount = ?, status = ?
                WHERE id = ?
            `).run(newPaid, newRemaining, newStatus, sale.id);
        }

        // 3. Delete from customer_account_transactions
        db.prepare(`DELETE FROM customer_account_transactions WHERE payment_id = ?`).run(paymentId);

        // 4. Delete the payment
        db.prepare('DELETE FROM customer_payments WHERE id = ?').run(paymentId);

        // 5. Recalculate customer balance
        const balanceStmt = db.prepare(`
            SELECT 
                COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) +
                COALESCE((SELECT SUM(original_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ?), 0) -
                COALESCE((SELECT SUM(amount) FROM customer_adjustments WHERE customer_id = ?), 0)
            AS balance
        `);
        const newBalance = balanceStmt.get(payment.customer_id, payment.customer_id, payment.customer_id, payment.customer_id).balance;

        const hasCustomerBalanceCol = db.prepare("PRAGMA table_info(customers)").all().some(c => c.name === 'balance');
        if (hasCustomerBalanceCol) {
            db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(newBalance, payment.customer_id);
        }

        auditLogger.logAction(
            req.body?.user || req.user?.username || 'مستخدم النظام',
            'حذف تحصيل دفعة',
            'العملاء',
            'سداد دفعة',
            paymentId,
            `تم حذف دفعة العميل بقيمة ${payment.amount} وإلغاء أثرها من الخزينة`
        );

        return { success: true, newBalance };
    });

    try {
        const result = transaction();
        res.json({ message: 'تم حذف الدفعة وتحديث الخزينة ورصيد العميل بنجاح', ...result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};



exports.getCustomerPrices = (req, res) => {
    try {
        const { id } = req.params;
        const prices = db.prepare('SELECT item_name, unit, price FROM customer_item_prices WHERE customer_id = ?').all(id);
        res.json(prices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



exports.updateCreditSale = (req, res) => {
    const saleId = req.params.id;
    let { customer_id, invoice_number, items, sale_date, sale_type, credit_deadline, paid_amount = 0, notes } = req.body;

    try {
        const transaction = db.transaction(() => {
            const oldSale = db.prepare('SELECT * FROM credit_sales WHERE id = ?').get(saleId);
            if (!oldSale) throw new Error('الفاتورة غير موجودة');
            if (oldSale.status === 'CANCELLED') throw new Error('لا يمكن تعديل فاتورة ملغاة');

            const targetCustomerId = customer_id || oldSale.customer_id;
            const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(targetCustomerId);
            if (!customer) throw new Error('العميل غير موجود');

            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new Error('يرجى إضافة صنف واحد على الأقل بالفاتورة');
            }

            let newOriginalAmount = 0;
            for (const item of items) {
                const qty = parseFloat(item.quantity);
                const price = parseFloat(item.unit_price);
                if (isNaN(qty) || qty <= 0) throw new Error(`الكمية غير صالحة للصنف: ${item.item_name || 'بدون اسم'}`);
                if (isNaN(price) || price < 0) throw new Error(`السعر غير صالح للصنف: ${item.item_name || 'بدون اسم'}`);
                newOriginalAmount += (qty * price);
            }

            const isCash = (sale_type === 'cash');
            const finalPaid = isCash ? newOriginalAmount : (parseFloat(paid_amount) || 0);
            if (finalPaid < 0 || finalPaid > newOriginalAmount) {
                throw new Error('قيمة المدفوع غير صحيحة');
            }

            const finalRemaining = newOriginalAmount - finalPaid;
            let newStatus = 'CONFIRMED';
            if (finalRemaining <= 0) {
                newStatus = 'PAID';
            } else if (finalPaid > 0) {
                newStatus = 'PARTIALLY_PAID';
            }

            const finalDeadline = isCash ? 0 : (parseInt(credit_deadline) || 0);
            let finalDueDate = null;
            if (sale_date) {
                const pd = new Date(sale_date);
                pd.setDate(pd.getDate() + finalDeadline);
                finalDueDate = pd.toISOString().split('T')[0];
            }

            // Delete old items
            db.prepare('DELETE FROM credit_sale_items WHERE credit_sale_id = ?').run(saleId);

            // Delete old SALE transaction log for this sale
            db.prepare("DELETE FROM customer_account_transactions WHERE credit_sale_id = ? AND transaction_type = 'SALE'").run(saleId);

            // Update credit_sales table
            db.prepare(`
                UPDATE credit_sales 
                SET customer_id = ?, invoice_number = ?, original_amount = ?, paid_amount = ?, remaining_amount = ?, sale_date = ?, credit_deadline = ?, due_date = ?, sale_type = ?, status = ?, notes = ?
                WHERE id = ?
            `).run(targetCustomerId, invoice_number || oldSale.invoice_number || saleId.toString(), newOriginalAmount, finalPaid, finalRemaining, sale_date || oldSale.sale_date, finalDeadline, finalDueDate, sale_type || oldSale.sale_type || 'credit', newStatus, notes || null, saleId);

            // Insert new items
            const insertItem = db.prepare(`
                INSERT INTO credit_sale_items (credit_sale_id, item_type, service_id, item_name, quantity, unit, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of items) {
                const qty = parseFloat(item.quantity);
                const price = parseFloat(item.unit_price);
                const total = qty * price;
                const itemType = item.item_type || 'product';
                const serviceId = item.service_id || null;

                insertItem.run(saleId, itemType, serviceId, item.item_name, qty, item.unit || 'طن', price, total);
            }

            // Recalculate customer balance and log transaction
            const balanceStmt = db.prepare(`SELECT COALESCE((SELECT CASE WHEN balance_type = 'debit' THEN amount ELSE -amount END FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?), 0) + COALESCE((SELECT SUM(remaining_amount) FROM credit_sales WHERE customer_id = ? AND status != 'CANCELLED'), 0) as balance`);
            const newCustBalance = balanceStmt.get(targetCustomerId, targetCustomerId).balance;

            db.prepare(`
                INSERT INTO customer_account_transactions (customer_id, credit_sale_id, transaction_type, amount, balance_after, transaction_date, notes)
                VALUES (?, ?, 'SALE', ?, ?, ?, ?)
            `).run(
                targetCustomerId,
                saleId,
                newOriginalAmount,
                newCustBalance,
                sale_date || oldSale.sale_date,
                notes || `تعديل فاتورة مبيعات رقم ${invoice_number || saleId}`
            );

            // Re-allocate costs
            try {
                purchaseAllocationService.reallocateSale(saleId, db);
            } catch (allocErr) {
                console.error('Allocation error during sale edit:', allocErr);
            }
        });

        transaction();
        res.json({ message: 'تم تعديل فاتورة المبيعات بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
