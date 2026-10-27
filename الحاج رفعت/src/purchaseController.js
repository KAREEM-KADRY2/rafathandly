const db = require('../db');
const auditLogger = require('./auditLogger');
const purchaseAllocationService = require('../services/purchaseAllocationService');

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

exports.createPurchase = (req, res) => {
    let { 
        supplier_id, 
        invoice_number, 
        items, 
        purchase_date, 
        location, 
        notes, 
        payment_type = 'credit', 
        account_id,
        payment_method = 'نقدي',
        paid_amount = 0, 
        credit_deadline, 
        due_date 
    } = req.body;
    
    try {
        const transaction = db.transaction(() => {
            // 1. Calculate total from backend
            let totalAmount = 0;
            if (!items || items.length === 0) throw new Error('لا يوجد أصناف في الفاتورة');
            
            for (const item of items) {
                totalAmount += (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
            }

            // Fetch supplier type first to decide payment logic
            let supplier = db.prepare('SELECT id, name, balance, type, default_credit_deadline FROM suppliers WHERE id = ?').get(supplier_id);
            if (!supplier) throw new Error('المورد غير موجود');

            let initialPaid = 0;
            let remainingAmount = 0;
            let status = 'CONFIRMED';
            const isFactory = supplier.type === 'مصنع';

            // Auto-detect payment_type if old payload
            if (!payment_type) {
                payment_type = isFactory ? 'balance_deduction' : 'credit';
            }

            if (payment_type === 'cash') {
                initialPaid = totalAmount;
                remainingAmount = 0;
                status = 'PAID';
            } else if (payment_type === 'balance_deduction') {
                if (totalAmount > (supplier.balance || 0)) {
                    throw new Error(`الرصيد المتاح لا يكفي لشراء هذه الفاتورة من المصنع. الرصيد المتاح: ${Number(supplier.balance || 0).toLocaleString()} ج.م`);
                }
                initialPaid = totalAmount;
                remainingAmount = 0;
                status = 'PAID';
            } else {
                payment_type = 'credit';
                initialPaid = Math.min(totalAmount, Math.max(0, Number(paid_amount) || 0));
                remainingAmount = totalAmount - initialPaid;
                status = remainingAmount === 0 ? 'PAID' : (initialPaid > 0 ? 'PARTIALLY_PAID' : 'CONFIRMED');
            }

            const finalCreditDeadline = credit_deadline !== undefined ? Number(credit_deadline) : (supplier.default_credit_deadline || 3);
            let finalDueDate = due_date;
            if (!finalDueDate && purchase_date) {
                const pd = new Date(purchase_date);
                pd.setDate(pd.getDate() + (Number(finalCreditDeadline) || 0));
                finalDueDate = pd.toISOString().split('T')[0];
            }

            const chosenAccountId = account_id ? Number(account_id) : (payment_type === 'cash' ? 1 : null);
            const chosenMethod = payment_method || 'نقدي';

            // 2. Create Purchase Record
            const insertPurchase = db.prepare(`
                INSERT INTO purchases (supplier_id, invoice_number, total_amount, paid_amount, remaining_amount, purchase_date, credit_deadline, due_date, location, notes, payment_type, account_id, payment_method, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const purchaseResult = insertPurchase.run(
                supplier_id, 
                invoice_number, 
                totalAmount, 
                initialPaid, 
                remainingAmount, 
                purchase_date, 
                finalCreditDeadline, 
                finalDueDate, 
                location, 
                notes,
                payment_type,
                chosenAccountId,
                chosenMethod,
                status
            );
            const purchaseId = purchaseResult.lastInsertRowid;

            // 3. Insert Items and Inventory Movements
            const insertItem = db.prepare(`
                INSERT INTO purchase_items (purchase_id, item_name, quantity, unit, base_quantity, base_unit, unit_price, total_price) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const findInventoryItem = db.prepare('SELECT * FROM inventory_items WHERE name = ?');
            const insertInventoryItem = db.prepare('INSERT INTO inventory_items (name, unit, secondary_unit, conversion_factor, conversion_operator) VALUES (?, ?, ?, ?, ?)');
            const insertInventoryMovement = db.prepare(`
                INSERT INTO inventory_movements (item_id, movement_type, quantity, unit, original_quantity, original_unit, reference_type, reference_id, supplier_id, movement_date)
                VALUES (?, 'IN', ?, ?, ?, ?, 'PURCHASE', ?, ?, ?)
            `);

            for (const item of items) {
                let inventoryItem = findInventoryItem.get(item.item_name);
                if (!inventoryItem) {
                    const defaults = getDefaultItemUnits(item.item_name, item.unit);
                    const resItem = insertInventoryItem.run(item.item_name, defaults.unit, defaults.secondary_unit, defaults.conversion_factor, defaults.conversion_operator);
                    inventoryItem = { id: resItem.lastInsertRowid, ...defaults };
                }

                let base_quantity = Number(item.quantity);
                let base_unit = item.unit;
                let original_quantity = Number(item.quantity);
                let original_unit = item.unit;

                if (inventoryItem.secondary_unit && inventoryItem.conversion_factor) {
                    if (item.unit === inventoryItem.secondary_unit) {
                        base_quantity = Number(item.quantity) / inventoryItem.conversion_factor;
                        base_unit = inventoryItem.unit;
                    } else if (item.unit === inventoryItem.unit) {
                        base_quantity = Number(item.quantity);
                        base_unit = inventoryItem.unit;
                    }
                }

                const itemTotal = Number(item.quantity) * Number(item.unit_price);
                insertItem.run(purchaseId, item.item_name, item.quantity, item.unit, base_quantity, base_unit, item.unit_price, itemTotal);
                
                insertInventoryMovement.run(
                    inventoryItem.id,
                    base_quantity,
                    base_unit,
                    original_quantity,
                    original_unit,
                    purchaseId,
                    supplier_id,
                    purchase_date
                );
            }

            // 4. Record the main Purchase in Account Transactions
            const txDate = purchase_date || new Date().toISOString();
            const invDisplay = invoice_number ? `رقم ${invoice_number}` : `رقم #${purchaseId}`;

            if (payment_type === 'cash') {
                const treasuryController = require('./treasuryController');
                treasuryController.recordTransaction({
                    account_id: chosenAccountId || 1,
                    type: 'OUT',
                    party_type: 'supplier',
                    party_id: supplier_id,
                    amount: totalAmount,
                    date: txDate,
                    payment_method: chosenMethod,
                    description: `سداد نقدي فوري لفاتورة شراء ${invDisplay} - ${supplier.name}`,
                    reference_type: 'purchase',
                    reference_id: purchaseId
                });

                if (isFactory) {
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(supplier_id, totalAmount, invoice_number || String(purchaseId), `فاتورة شراء نقدية مسددة بالكامل ${invDisplay}${notes ? ' - ' + notes : ''}`, txDate);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'deposit', ?, ?, ?)`).run(supplier_id, -totalAmount, invoice_number || String(purchaseId), `سداد نقدي فوري لفاتورة شراء ${invDisplay}`, txDate);
                } else {
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(totalAmount, supplier_id);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(supplier_id, totalAmount, invoice_number || String(purchaseId), `فاتورة شراء نقدية ${invDisplay}${notes ? ' - ' + notes : ''}`, txDate);
                    
                    db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(totalAmount, supplier_id);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'deposit', ?, ?, ?)`).run(supplier_id, -totalAmount, invoice_number || String(purchaseId), `سداد نقدي فوري لفاتورة شراء ${invDisplay}`, txDate);
                }
            } else if (payment_type === 'balance_deduction') {
                db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(totalAmount, supplier_id);
                db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(supplier_id, -totalAmount, invoice_number || String(purchaseId), `خصم فاتورة شراء ${invDisplay} من الرصيد المتاح${notes ? ' - ' + notes : ''}`, txDate);
            } else {
                // credit
                if (isFactory) {
                    db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(totalAmount, supplier_id);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(supplier_id, -totalAmount, invoice_number || String(purchaseId), `فاتورة شراء على الحساب ${invDisplay}${notes ? ' - ' + notes : ''}`, txDate);
                } else {
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(totalAmount, supplier_id);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(supplier_id, totalAmount, invoice_number || String(purchaseId), `إضافة فاتورة شراء ${invDisplay}${notes ? ' - ' + notes : ''}`, txDate);
                    
                    if (initialPaid > 0) {
                        db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(initialPaid, supplier_id);
                        db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'deposit', ?, ?, ?)`).run(supplier_id, -initialPaid, invoice_number || String(purchaseId), `سداد دفعة من فاتورة شراء ${invDisplay}`, txDate);
                        
                        const treasuryController = require('./treasuryController');
                        treasuryController.recordTransaction({
                            account_id: chosenAccountId || 1,
                            type: 'OUT',
                            party_type: 'supplier',
                            party_id: supplier_id,
                            amount: initialPaid,
                            date: txDate,
                            payment_method: chosenMethod,
                            description: `سداد دفعة من فاتورة شراء ${invDisplay}`,
                            reference_type: 'purchase',
                            reference_id: purchaseId
                        });
                    }
                }
            }

            return purchaseId;
        });

        const newPurchaseId = transaction();
        res.status(201).json({ id: newPurchaseId, message: 'تم تسجيل فاتورة الشراء بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getPurchasesBySupplier = (req, res) => {
    try {
        const purchases = db.prepare(`
            SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.type as supplier_type, fa.name as account_name 
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN financial_accounts fa ON p.account_id = fa.id
            WHERE p.supplier_id = ?
            ORDER BY p.purchase_date DESC, p.created_at DESC
        `).all(req.params.supplierId);
        
        for (let purchase of purchases) {
            purchase.items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);
            const allCustomerSalesMap = new Map();
            for (let item of purchase.items) {
                const tracking = purchaseAllocationService.getPurchaseItemAllocations(item.id, db);
                if (tracking) {
                    item.sold_quantity = tracking.sold_quantity;
                    item.remaining_quantity = tracking.remaining_quantity;
                    item.customer_sales = tracking.customer_sales;
                    tracking.customer_sales.forEach(cs => {
                        const key = cs.customer_name;
                        const current = allCustomerSalesMap.get(key) || 0;
                        const itemQty = Number(cs.quantity || cs.base_quantity || 0);
                        allCustomerSalesMap.set(key, current + itemQty);
                    });
                } else {
                    item.sold_quantity = 0;
                    item.remaining_quantity = item.quantity;
                    item.customer_sales = [];
                }
            }
            if (allCustomerSalesMap.size > 0) {
                const summaryParts = [];
                allCustomerSalesMap.forEach((qty, name) => {
                    const formattedQty = Math.round(qty * 100) / 100;
                    summaryParts.push(`${name} (${formattedQty} طن)`);
                });
                purchase.customer_tracking_summary = 'تم البيع لـ: ' + summaryParts.join('، ');
            } else {
                purchase.customer_tracking_summary = 'لم يتم البيع منها بعد';
            }
            purchase.payments = [];
            const isOverdue = purchase.remaining_amount > 0 && purchase.due_date && purchase.due_date.split(' ')[0] < new Date().toISOString().split('T')[0];
            purchase.is_overdue = isOverdue;
            purchase.computed_status = (purchase.payment_type === 'cash' || purchase.remaining_amount <= 0)
                ? 'PAID' 
                : (isOverdue ? 'OVERDUE' : (purchase.paid_amount > 0 ? 'PARTIALLY_PAID' : 'UNPAID'));
        }
        
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPurchaseById = (req, res) => {
    try {
        const purchase = db.prepare(`
            SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.type as supplier_type, fa.name as account_name 
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN financial_accounts fa ON p.account_id = fa.id
            WHERE p.id = ?
        `).get(req.params.id);
        
        if (!purchase) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        
        purchase.items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);
        let overallPurchased = 0;
        let overallSold = 0;
        let overallRemaining = 0;

        for (let item of purchase.items) {
            const tracking = purchaseAllocationService.getPurchaseItemAllocations(item.id, db);
            if (tracking) {
                item.sold_quantity = tracking.sold_quantity;
                item.remaining_quantity = tracking.remaining_quantity;
                item.customer_sales = tracking.customer_sales;
            } else {
                item.sold_quantity = 0;
                item.remaining_quantity = item.quantity;
                item.customer_sales = [];
            }
            overallPurchased += (item.quantity || 0);
            overallSold += (item.sold_quantity || 0);
            overallRemaining += (item.remaining_quantity || 0);
        }

        purchase.total_purchased_quantity = Math.round(overallPurchased * 10000) / 10000;
        purchase.total_sold_quantity = Math.round(overallSold * 10000) / 10000;
        purchase.total_remaining_quantity = Math.round(overallRemaining * 10000) / 10000;
        purchase.payments = [];
        const isOverdue = purchase.remaining_amount > 0 && purchase.due_date && purchase.due_date.split(' ')[0] < new Date().toISOString().split('T')[0];
        purchase.is_overdue = isOverdue;
        purchase.computed_status = (purchase.payment_type === 'cash' || purchase.remaining_amount <= 0)
            ? 'PAID' 
            : (isOverdue ? 'OVERDUE' : (purchase.paid_amount > 0 ? 'PARTIALLY_PAID' : 'UNPAID'));
        
        const obRow = db.prepare("SELECT balance_type, amount, effective_date, notes FROM opening_balances WHERE entity_type IN ('supplier', 'factory') AND entity_id = ?").get(purchase.supplier_id);
        purchase.opening_balance = obRow ? {
            amount: Number(obRow.amount) || 0,
            balance_type: obRow.balance_type || 'credit',
            effective_date: obRow.effective_date,
            notes: obRow.notes
        } : null;

        res.json(purchase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.recordSupplierPayment = (req, res) => {
    const { supplier_id, purchase_id, amount, payment_date, payment_method, reference_number, notes, account_id } = req.body;
    
    try {
        const transaction = db.transaction(() => {
            const numAmount = Number(amount);
            if (numAmount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');

            let supplier = db.prepare('SELECT type FROM suppliers WHERE id = ?').get(supplier_id);
            if (!supplier) throw new Error('المورد غير موجود');
            
            if (supplier.type === 'مصنع') {
                if (purchase_id) {
                    throw new Error('لا يمكن تسديد فاتورة للمصنع، يتم دفع رصيد فقط.');
                }
                db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(numAmount, supplier_id);
                db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description) VALUES (?, ?, 'deposit', ?, ?)`).run(supplier_id, numAmount, reference_number || '', notes || 'إضافة رصيد للمصنع');
            } else {
                let remainingPayment = numAmount;
                
                // If a specific purchase is selected
                if (purchase_id) {
                    let targetPurchase = db.prepare('SELECT * FROM purchases WHERE id = ? AND supplier_id = ?').get(purchase_id, supplier_id);
                    if (!targetPurchase) throw new Error('الفاتورة غير موجودة');
                    if (targetPurchase.remaining_amount < numAmount) {
                        throw new Error(`المبلغ المدفوع أكبر من المتبقي على الفاتورة (${targetPurchase.remaining_amount})`);
                    }
                    
                    db.prepare('UPDATE purchases SET paid_amount = paid_amount + ?, remaining_amount = remaining_amount - ? WHERE id = ?').run(numAmount, numAmount, purchase_id);
                    
                } else {
                    // Auto-distribute the payment across oldest unpaid invoices
                    const unpaidInvoices = db.prepare('SELECT id, invoice_number, remaining_amount FROM purchases WHERE supplier_id = ? AND remaining_amount > 0 ORDER BY purchase_date ASC, id ASC').all(supplier_id);
                    
                    for (const inv of unpaidInvoices) {
                        if (remainingPayment <= 0) break;
                        const deduct = Math.min(remainingPayment, inv.remaining_amount);
                        db.prepare('UPDATE purchases SET paid_amount = paid_amount + ?, remaining_amount = remaining_amount - ? WHERE id = ?').run(deduct, deduct, inv.id);
                        remainingPayment -= deduct;
                    }
                }
                
                // Update overall supplier balance (reduce debt)
                db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(numAmount, supplier_id);
                
                let desc = notes || 'تسديد دفعة عامة للمورد';
                if (purchase_id) {
                    const invNumber = db.prepare('SELECT invoice_number FROM purchases WHERE id = ?').get(purchase_id)?.invoice_number || purchase_id;
                    desc = notes || `تسديد دفعة من فاتورة رقم ${invNumber}`;
                }

                db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description) VALUES (?, ?, 'deposit', ?, ?)`).run(supplier_id, -numAmount, reference_number || String(purchase_id || ''), desc);
            }
            
            const treasuryController = require('./treasuryController');
            const suppName = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(supplier_id)?.name;
            const defAcc = db.prepare("SELECT id FROM financial_accounts WHERE type = 'CASH' LIMIT 1").get();
            const targetAccountId = account_id ? Number(account_id) : (defAcc?.id || 1);
            const chosenAcc = db.prepare('SELECT name FROM financial_accounts WHERE id = ?').get(targetAccountId);
            const finalMethod = chosenAcc ? chosenAcc.name : (payment_method || 'نقدي');

            treasuryController.recordTransaction({
                account_id: targetAccountId,
                type: 'OUT',
                party_type: 'supplier',
                party_id: supplier_id,
                party_name: suppName,
                amount: numAmount,
                description: notes || (supplier.type === 'مصنع' ? `إيداع رصيد للمصنع (${suppName})` : (purchase_id ? `تسديد فاتورة مورد (${suppName})` : `تسديد دفعة للمورد (${suppName})`)),
                reference_type: 'supplier_payment',
                reference_id: purchase_id || null,
                payment_method: payment_method || finalMethod,
                transaction_date: payment_date
            });
            
            return { success: true };
        });

        transaction();
        res.json({ message: 'تم تسجيل الدفعة بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.downloadPurchaseInvoicePDF = async (req, res) => {
    try {
        const id = req.params.id;
        const purchase = db.prepare(`
            SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.type as supplier_type, fa.name as account_name 
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN financial_accounts fa ON p.account_id = fa.id
            WHERE p.id = ?
        `).get(id);
        
        if (!purchase) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        
        const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);
        const obRow = db.prepare("SELECT balance_type, amount, effective_date, notes FROM opening_balances WHERE entity_type IN ('supplier', 'factory') AND entity_id = ?").get(purchase.supplier_id);

        const paymentTypeLabel = purchase.payment_type === 'cash' 
            ? 'نقدي (مسددة بالكامل فوراً)' 
            : (purchase.payment_type === 'balance_deduction' ? 'خصم من رصيد المصنع' : 'آجل (على الحساب)');

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                body { font-family: 'Cairo', sans-serif; color: #1f2937; margin: 0; padding: 0; background: white; }
                .container { padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #1e3a8a; margin: 0 0 10px 0; font-size: 28px; }
                .header h2 { color: #4b5563; margin: 0; font-size: 20px; }
                .separator { height: 2px; background: #e5e7eb; margin: 20px 0; }
                
                .info-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px; background-color: #f9fafb; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .info-row { display: flex; }
                .info-label { font-weight: 700; width: 130px; color: #4b5563; }
                .info-value { font-weight: 600; color: #111827; }

                table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                th { background-color: #1e3a8a; color: white; padding: 12px; text-align: right; border: 1px solid #1e3a8a; }
                td { padding: 12px; border: 1px solid #e5e7eb; color: #374151; font-weight: bold; }
                tbody tr:nth-child(even) { background-color: #f9fafb; }

                .totals { float: left; width: 300px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
                .total-row { display: flex; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #e5e7eb; }
                .total-row.final { background-color: #1e3a8a; color: white; border: none; font-size: 18px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>الحندقوتي جروب</h1>
                    <h2>فاتورة مشتريات</h2>
                </div>
                
                <div class="separator"></div>

                <div class="info-card">
                    <div class="info-row"><div class="info-label">رقم الفاتورة:</div><div class="info-value" dir="ltr">${purchase.invoice_number || purchase.id}</div></div>
                    <div class="info-row"><div class="info-label">تاريخ الفاتورة:</div><div class="info-value">${new Date(purchase.purchase_date).toLocaleDateString('ar-EG')}</div></div>
                    <div class="info-row"><div class="info-label">اسم المورد/المصنع:</div><div class="info-value">${purchase.supplier_name}</div></div>
                    ${obRow && Number(obRow.amount) > 0 ? `<div class="info-row"><div class="info-label">الرصيد الافتتاحي:</div><div class="info-value" dir="ltr">${Number(obRow.amount).toLocaleString()} ج.م (${obRow.balance_type === 'credit' ? 'له / دائن' : 'عليه / مدين'})</div></div>` : ''}
                    <div class="info-row"><div class="info-label">نوع السداد:</div><div class="info-value">${paymentTypeLabel}</div></div>
                    ${purchase.account_name ? `<div class="info-row"><div class="info-label">الخزينة/الحساب:</div><div class="info-value">${purchase.account_name}</div></div>` : ''}
                    <div class="info-row"><div class="info-label">ملاحظات:</div><div class="info-value">${purchase.notes || '-'}</div></div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>الصنف</th>
                            <th>الكمية</th>
                            <th>الوحدة</th>
                            <th>سعر الوحدة</th>
                            <th>الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.item_name}</td>
                                <td>${item.quantity}</td>
                                <td>${item.unit}</td>
                                <td dir="ltr">${Number(item.unit_price).toLocaleString()}</td>
                                <td dir="ltr">${Number(item.total_price).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals">
                    ${obRow && Number(obRow.amount) > 0 ? `<div class="total-row" style="background:#f0fdf4; color:#166534;"><span>الرصيد الافتتاحي:</span><span dir="ltr">${Number(obRow.amount).toLocaleString()} ج.م (${obRow.balance_type === 'credit' ? 'له' : 'عليه'})</span></div>` : ''}
                    <div class="total-row"><span>الإجمالي:</span><span dir="ltr">${Number(purchase.total_amount).toLocaleString()} ج.م</span></div>
                    <div class="total-row"><span>المدفوع:</span><span dir="ltr" style="color: green;">${Number(purchase.paid_amount).toLocaleString()} ج.م</span></div>
                    <div class="total-row final"><span>المتبقي:</span><span dir="ltr">${Number(purchase.remaining_amount).toLocaleString()} ج.م</span></div>
                </div>
            </div>
        </body>
        </html>
        `;

        const getBrowserPath = () => {
            const fsReq = require('fs');
            const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
            if (fsReq.existsSync(chromePath)) return chromePath;
            if (fsReq.existsSync(edgePath)) return edgePath;
            return undefined;
        };

        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ 
            headless: 'new',
            ...(getBrowserPath() ? { executablePath: getBrowserPath() } : {})
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const pdfBuffer = await page.pdf({ 
            format: 'A4', 
            margin: { top: '20mm', right: '10mm', bottom: '20mm', left: '10mm' },
            printBackground: true
        });
        await browser.close();

        res.setHeader('Content-disposition', `attachment; filename=purchase_invoice_${id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        res.end(pdfBuffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePurchase = (req, res) => {
    const purchaseId = req.params.id;
    let { 
        supplier_id, 
        invoice_number, 
        items, 
        purchase_date, 
        location, 
        notes, 
        payment_type = 'credit', 
        account_id,
        payment_method = 'نقدي',
        paid_amount = 0, 
        credit_deadline, 
        due_date 
    } = req.body;

    try {
        const transaction = db.transaction(() => {
            const oldPurchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
            if (!oldPurchase) throw new Error('الفاتورة غير موجودة');

            const targetSupplierId = supplier_id || oldPurchase.supplier_id;
            const oldSupplier = db.prepare('SELECT balance, type FROM suppliers WHERE id = ?').get(oldPurchase.supplier_id);
            const newSupplier = db.prepare('SELECT balance, type FROM suppliers WHERE id = ?').get(targetSupplierId);
            if (!newSupplier) throw new Error('المورد غير موجود');

            // 1. Revert old supplier balance
            if (oldSupplier) {
                if (oldPurchase.payment_type === 'cash') {
                    // Net debt impact was 0, nothing to reverse on supplier balance
                } else if (oldPurchase.payment_type === 'balance_deduction') {
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(oldPurchase.total_amount, oldPurchase.supplier_id);
                } else if (oldSupplier.type === 'مصنع') {
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(oldPurchase.total_amount, oldPurchase.supplier_id);
                } else {
                    db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(oldPurchase.remaining_amount, oldPurchase.supplier_id);
                }
            }

            // 2. Revert old Treasury transaction if exists
            const oldTreasuryTx = db.prepare(`SELECT * FROM treasury_transactions WHERE reference_type = 'purchase' AND reference_id = ?`).get(purchaseId);
            if (oldTreasuryTx) {
                if (oldTreasuryTx.type === 'OUT') {
                    db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(oldTreasuryTx.amount, oldTreasuryTx.account_id);
                } else if (oldTreasuryTx.type === 'IN') {
                    db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(oldTreasuryTx.amount, oldTreasuryTx.account_id);
                }
                db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(oldTreasuryTx.id);
            }

            // 3. Delete old balance transactions and inventory movements
            db.prepare(`DELETE FROM supplier_balance_transactions WHERE (reference_number = ? OR reference_number = ?) AND supplier_id = ?`)
              .run(oldPurchase.invoice_number || String(purchaseId), String(purchaseId), oldPurchase.supplier_id);

            db.prepare(`DELETE FROM inventory_movements WHERE reference_type = 'PURCHASE' AND reference_id = ?`).run(purchaseId);

            // 4. Calculate new total
            let totalAmount = 0;
            if (!items || items.length === 0) throw new Error('لا يوجد أصناف في الفاتورة');
            for (const item of items) {
                totalAmount += (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
            }

            let initialPaid = 0;
            let remainingAmount = 0;
            let status = 'CONFIRMED';
            const isFactory = newSupplier.type === 'مصنع';

            if (!payment_type) {
                payment_type = isFactory ? 'balance_deduction' : 'credit';
            }

            const updatedNewSupplier = db.prepare('SELECT balance, type FROM suppliers WHERE id = ?').get(targetSupplierId);

            if (payment_type === 'cash') {
                initialPaid = totalAmount;
                remainingAmount = 0;
                status = 'PAID';
            } else if (payment_type === 'balance_deduction') {
                if (totalAmount > (updatedNewSupplier.balance || 0)) {
                    throw new Error(`الرصيد المتاح لا يكفي لشراء هذه الفاتورة من المصنع. الرصيد المتاح: ${Number(updatedNewSupplier.balance || 0).toLocaleString()} ج.م`);
                }
                initialPaid = totalAmount;
                remainingAmount = 0;
                status = 'PAID';
            } else {
                payment_type = 'credit';
                initialPaid = Math.min(totalAmount, Math.max(0, Number(paid_amount) || 0));
                remainingAmount = totalAmount - initialPaid;
                status = remainingAmount === 0 ? 'PAID' : (initialPaid > 0 ? 'PARTIALLY_PAID' : 'CONFIRMED');
            }

            const finalCreditDeadline = credit_deadline !== undefined ? Number(credit_deadline) : (oldPurchase.credit_deadline || 3);
            let finalDueDate = due_date;
            if (!finalDueDate && purchase_date) {
                const pd = new Date(purchase_date);
                pd.setDate(pd.getDate() + (Number(finalCreditDeadline) || 0));
                finalDueDate = pd.toISOString().split('T')[0];
            }

            const chosenAccountId = account_id ? Number(account_id) : (payment_type === 'cash' ? 1 : null);
            const chosenMethod = payment_method || 'نقدي';

            // 5. Update purchases record
            db.prepare(`
                UPDATE purchases 
                SET supplier_id = ?, invoice_number = ?, total_amount = ?, paid_amount = ?, remaining_amount = ?, purchase_date = ?, credit_deadline = ?, due_date = ?, location = ?, notes = ?, payment_type = ?, account_id = ?, payment_method = ?, status = ?
                WHERE id = ?
            `).run(targetSupplierId, invoice_number, totalAmount, initialPaid, remainingAmount, purchase_date, finalCreditDeadline, finalDueDate, location, notes, payment_type, chosenAccountId, chosenMethod, status, purchaseId);

            db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(purchaseId);

            const insertItem = db.prepare(`
                INSERT INTO purchase_items (purchase_id, item_name, quantity, unit, base_quantity, base_unit, unit_price, total_price) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const findInventoryItem = db.prepare('SELECT * FROM inventory_items WHERE name = ?');
            const insertInventoryItem = db.prepare('INSERT INTO inventory_items (name, unit, secondary_unit, conversion_factor, conversion_operator) VALUES (?, ?, ?, ?, ?)');
            const insertInventoryMovement = db.prepare(`
                INSERT INTO inventory_movements (item_id, movement_type, quantity, unit, original_quantity, original_unit, reference_type, reference_id, supplier_id, movement_date)
                VALUES (?, 'IN', ?, ?, ?, ?, 'PURCHASE', ?, ?, ?)
            `);

            for (const item of items) {
                let inventoryItem = findInventoryItem.get(item.item_name);
                if (!inventoryItem) {
                    const defaults = getDefaultItemUnits(item.item_name, item.unit);
                    const resItem = insertInventoryItem.run(item.item_name, defaults.unit, defaults.secondary_unit, defaults.conversion_factor, defaults.conversion_operator);
                    inventoryItem = { id: resItem.lastInsertRowid, ...defaults };
                }

                let base_quantity = Number(item.quantity);
                let base_unit = item.unit;
                let original_quantity = Number(item.quantity);
                let original_unit = item.unit;

                if (inventoryItem.secondary_unit && inventoryItem.conversion_factor) {
                    if (item.unit === inventoryItem.secondary_unit) {
                        base_quantity = Number(item.quantity) / inventoryItem.conversion_factor;
                        base_unit = inventoryItem.unit;
                    } else if (item.unit === inventoryItem.unit) {
                        base_quantity = Number(item.quantity);
                        base_unit = inventoryItem.unit;
                    }
                }

                const itemTotal = Number(item.quantity) * Number(item.unit_price);
                insertItem.run(purchaseId, item.item_name, item.quantity, item.unit, base_quantity, base_unit, item.unit_price, itemTotal);
                
                insertInventoryMovement.run(
                    inventoryItem.id,
                    base_quantity,
                    base_unit,
                    original_quantity,
                    original_unit,
                    purchaseId,
                    targetSupplierId,
                    purchase_date
                );
            }

            // 6. Record updated financial movements
            const txDate = purchase_date || new Date().toISOString();
            const invDisplay = invoice_number ? `رقم ${invoice_number}` : `رقم #${purchaseId}`;

            if (payment_type === 'cash') {
                const treasuryController = require('./treasuryController');
                treasuryController.recordTransaction({
                    account_id: chosenAccountId || 1,
                    type: 'OUT',
                    party_type: 'supplier',
                    party_id: targetSupplierId,
                    amount: totalAmount,
                    date: txDate,
                    payment_method: chosenMethod,
                    description: `سداد نقدي فوري لفاتورة شراء معدلة ${invDisplay} - ${newSupplier.name}`,
                    reference_type: 'purchase',
                    reference_id: purchaseId
                });

                if (isFactory) {
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(targetSupplierId, totalAmount, invoice_number || String(purchaseId), `فاتورة شراء نقدية مسددة بالكامل ${invDisplay}${notes ? ' - ' + notes : ''}`, txDate);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'deposit', ?, ?, ?)`).run(targetSupplierId, -totalAmount, invoice_number || String(purchaseId), `سداد نقدي فوري لفاتورة شراء ${invDisplay}`, txDate);
                } else {
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(totalAmount, targetSupplierId);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(targetSupplierId, totalAmount, invoice_number || String(purchaseId), `فاتورة شراء نقدية ${invDisplay}${notes ? ' - ' + notes : ''}`, txDate);
                    
                    db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(totalAmount, targetSupplierId);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'deposit', ?, ?, ?)`).run(targetSupplierId, -totalAmount, invoice_number || String(purchaseId), `سداد نقدي فوري لفاتورة شراء ${invDisplay}`, txDate);
                }
            } else if (payment_type === 'balance_deduction') {
                db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(totalAmount, targetSupplierId);
                db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(targetSupplierId, -totalAmount, invoice_number || String(purchaseId), `خصم فاتورة شراء ${invDisplay} من الرصيد المتاح${notes ? ' - ' + notes : ''}`, txDate);
            } else {
                // credit
                if (isFactory) {
                    db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(totalAmount, targetSupplierId);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(targetSupplierId, -totalAmount, invoice_number || String(purchaseId), `فاتورة شراء على الحساب ${invDisplay}${notes ? ' - ' + notes : ''}`, txDate);
                } else {
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(totalAmount, targetSupplierId);
                    db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'purchase', ?, ?, ?)`).run(targetSupplierId, totalAmount, invoice_number || String(purchaseId), `إضافة فاتورة شراء ${invDisplay}${notes ? ' - ' + notes : ''}`, txDate);
                    
                    if (initialPaid > 0) {
                        db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(initialPaid, targetSupplierId);
                        db.prepare(`INSERT INTO supplier_balance_transactions (supplier_id, amount, transaction_type, reference_number, description, created_at) VALUES (?, ?, 'deposit', ?, ?, ?)`).run(targetSupplierId, -initialPaid, invoice_number || String(purchaseId), `سداد دفعة من فاتورة شراء ${invDisplay}`, txDate);
                        
                        const treasuryController = require('./treasuryController');
                        treasuryController.recordTransaction({
                            account_id: chosenAccountId || 1,
                            type: 'OUT',
                            party_type: 'supplier',
                            party_id: targetSupplierId,
                            amount: initialPaid,
                            date: txDate,
                            payment_method: chosenMethod,
                            description: `سداد دفعة من فاتورة شراء ${invDisplay}`,
                            reference_type: 'purchase',
                            reference_id: purchaseId
                        });
                    }
                }
            }

            return purchaseId;
        });

        transaction();
        res.json({ message: 'تم تعديل فاتورة الشراء وتحديث الحسابات بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deletePurchase = (req, res) => {
    const purchaseId = req.params.id;

    try {
        const transaction = db.transaction(() => {
            const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
            if (!purchase) throw new Error('فاتورة المشتريات غير موجودة أو تم حذفها مسبقاً');

            const supplier = db.prepare('SELECT id, name, balance, type FROM suppliers WHERE id = ?').get(purchase.supplier_id);
            if (!supplier) throw new Error('المورد أو المصنع المرتبط بهذه الفاتورة غير موجود');
            const isFactory = supplier.type === 'مصنع';

            // 1. Revert supplier balance
            if (isFactory) {
                if (purchase.payment_type === 'cash') {
                    // Net debt impact on factory was 0
                } else {
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(purchase.total_amount, supplier.id);
                }
            } else {
                if (purchase.payment_type === 'cash') {
                    // Net debt impact was 0
                } else if (purchase.payment_type === 'balance_deduction') {
                    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(purchase.total_amount, supplier.id);
                } else {
                    // Credit purchase: cancel unpaid debt
                    db.prepare('UPDATE suppliers SET balance = balance - ? WHERE id = ?').run(purchase.remaining_amount, supplier.id);
                }
            }

            // 2. Revert treasury transactions (refund paid cash back to financial accounts)
            const treasuryTxs = db.prepare(`
                SELECT * FROM treasury_transactions 
                WHERE (reference_type IN ('purchase', 'PURCHASE', 'supplier_payment') AND reference_id = ?)
            `).all(purchaseId);

            for (const tTx of treasuryTxs) {
                if (tTx.type === 'OUT') {
                    db.prepare('UPDATE financial_accounts SET balance = balance + ? WHERE id = ?').run(tTx.amount, tTx.account_id);
                } else if (tTx.type === 'IN') {
                    db.prepare('UPDATE financial_accounts SET balance = balance - ? WHERE id = ?').run(tTx.amount, tTx.account_id);
                }
                db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(tTx.id);
            }

            // 3. Delete purchase allocations if any
            try {
                db.prepare(`
                    DELETE FROM sale_item_purchase_allocations 
                    WHERE purchase_item_id IN (SELECT id FROM purchase_items WHERE purchase_id = ?)
                `).run(purchaseId);
            } catch (allocErr) {
                // Table might not exist or empty
            }

            // 4. Revert inventory movements
            db.prepare(`DELETE FROM inventory_movements WHERE reference_type = 'PURCHASE' AND reference_id = ?`).run(purchaseId);

            // 5. Delete supplier balance transactions
            db.prepare(`
                DELETE FROM supplier_balance_transactions 
                WHERE supplier_id = ? AND (
                    reference_number = ? OR reference_number = ? OR description LIKE ?
                )
            `).run(
                purchase.supplier_id, 
                purchase.invoice_number || String(purchaseId), 
                String(purchaseId), 
                `%#${purchaseId}%`
            );

            // 6. Delete purchase items and the purchase record
            db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(purchaseId);
            db.prepare('DELETE FROM purchases WHERE id = ?').run(purchaseId);

            // 7. Audit log
            try {
                auditLogger.log({
                    action: 'DELETE_PURCHASE',
                    entity_type: 'purchase',
                    entity_id: purchaseId,
                    details: `حذف فاتورة شراء رقم ${purchase.invoice_number || purchaseId} للمورد ${supplier.name} بقيمة ${purchase.total_amount} ج.م وتحديث الحسابات المرتبطة`
                });
            } catch (e) {
                console.error('Audit log error:', e.message);
            }

            const updatedSupplier = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(supplier.id);
            return {
                supplier_id: supplier.id,
                supplier_name: supplier.name,
                supplier_type: supplier.type,
                new_balance: updatedSupplier ? updatedSupplier.balance : 0
            };
        });

        const result = transaction();
        const roleLabel = result.supplier_type === 'مصنع' ? 'المصنع' : 'المورد';
        res.json({
            success: true,
            message: `تم حذف فاتورة الشراء وتحديث حساب ${roleLabel} (${result.supplier_name}) بنجاح. الرصيد الحالي: ${Number(result.new_balance).toLocaleString()} ج.م`,
            ...result
        });
    } catch (error) {
        console.error('Error deleting purchase:', error);
        res.status(400).json({ error: error.message });
    }
};
