function getDb(customDb) {
    return customDb || require('../db');
}

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

function initSchema(customDb) {
    const targetDb = getDb(customDb);
    targetDb.exec(`
        CREATE TABLE IF NOT EXISTS sale_item_purchase_allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_item_id INTEGER NOT NULL,
            purchase_item_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            base_quantity REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sale_item_id) REFERENCES credit_sale_items(id) ON DELETE CASCADE,
            FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_alloc_sale_item ON sale_item_purchase_allocations(sale_item_id);
        CREATE INDEX IF NOT EXISTS idx_alloc_purchase_item ON sale_item_purchase_allocations(purchase_item_id);
    `);
}

function allocateSaleItemToPurchaseStock(saleItemId, customDb) {
    const targetDb = getDb(customDb);
    initSchema(targetDb);

    // Get sale item details
    const saleItem = targetDb.prepare(`
        SELECT csi.*, cs.sale_date, cs.customer_id, cs.status as sale_status
        FROM credit_sale_items csi
        JOIN credit_sales cs ON csi.credit_sale_id = cs.id
        WHERE csi.id = ?
    `).get(saleItemId);

    if (!saleItem || saleItem.item_type === 'service' || saleItem.sale_status === 'CANCELLED') {
        return;
    }

    // Delete any existing allocations for this sale_item_id before allocating
    targetDb.prepare('DELETE FROM sale_item_purchase_allocations WHERE sale_item_id = ?').run(saleItemId);

    // Fetch inventory items to calculate base quantity
    const invItems = targetDb.prepare('SELECT id, name, unit, secondary_unit, conversion_factor, conversion_operator FROM inventory_items').all();
    const normItemName = normalizeArabic(saleItem.item_name);
    const invItem = invItems.find(i => i.name === saleItem.item_name || normalizeArabic(i.name) === normItemName);

    let saleBaseQty = parseFloat(saleItem.quantity) || 0;
    if (invItem && invItem.secondary_unit && invItem.conversion_factor) {
        const factor = parseFloat(invItem.conversion_factor);
        const normUnit = normalizeArabic(saleItem.unit);
        const normSec = normalizeArabic(invItem.secondary_unit);
        if (normUnit === normSec || saleItem.unit === invItem.secondary_unit) {
            saleBaseQty = (invItem.conversion_operator === '*') ? (parseFloat(saleItem.quantity) * factor) : (parseFloat(saleItem.quantity) / factor);
        }
    }

    if (saleBaseQty <= 0) return;

    // Fetch purchase items matching the item name ordered by FIFO (purchase_date ASC, id ASC)
    const purchaseItems = targetDb.prepare(`
        SELECT pi.*, p.purchase_date, p.invoice_number
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id
        ORDER BY p.purchase_date ASC, p.id ASC, pi.id ASC
    `).all();

    const matchingPurchaseItems = purchaseItems.filter(pi => {
        return pi.item_name === saleItem.item_name || normalizeArabic(pi.item_name) === normItemName;
    });

    let neededBaseQty = saleBaseQty;

    for (const pi of matchingPurchaseItems) {
        if (neededBaseQty <= 0) break;

        const piBaseQty = (pi.base_quantity && pi.base_quantity > 0) ? pi.base_quantity : pi.quantity;

        // Calculate already allocated base qty from non-cancelled sales
        const allocatedRow = targetDb.prepare(`
            SELECT COALESCE(SUM(a.base_quantity), 0) as total_allocated
            FROM sale_item_purchase_allocations a
            JOIN credit_sale_items csi ON a.sale_item_id = csi.id
            JOIN credit_sales cs ON csi.credit_sale_id = cs.id
            WHERE a.purchase_item_id = ? AND cs.status != 'CANCELLED' AND a.sale_item_id != ?
        `).get(pi.id, saleItemId);

        const alreadyAllocatedBaseQty = allocatedRow ? allocatedRow.total_allocated : 0;
        const availableBaseQty = piBaseQty - alreadyAllocatedBaseQty;

        if (availableBaseQty > 0) {
            const allocBaseQty = Math.min(neededBaseQty, availableBaseQty);
            const allocQty = (allocBaseQty / saleBaseQty) * saleItem.quantity;

            targetDb.prepare(`
                INSERT INTO sale_item_purchase_allocations (sale_item_id, purchase_item_id, quantity, base_quantity)
                VALUES (?, ?, ?, ?)
            `).run(saleItemId, pi.id, allocQty, allocBaseQty);

            neededBaseQty -= allocBaseQty;
        }
    }
}

function reallocateSale(creditSaleId, customDb) {
    const targetDb = getDb(customDb);
    initSchema(targetDb);

    targetDb.prepare(`
        DELETE FROM sale_item_purchase_allocations 
        WHERE sale_item_id IN (SELECT id FROM credit_sale_items WHERE credit_sale_id = ?)
    `).run(creditSaleId);

    const items = targetDb.prepare("SELECT id FROM credit_sale_items WHERE credit_sale_id = ? AND (item_type IS NULL OR item_type != 'service')").all(creditSaleId);
    for (const item of items) {
        allocateSaleItemToPurchaseStock(item.id, targetDb);
    }
}

function getPurchaseItemAllocations(purchaseItemId, customDb) {
    const targetDb = getDb(customDb);
    initSchema(targetDb);

    const pi = targetDb.prepare(`
        SELECT pi.*, p.purchase_date, p.invoice_number, s.name as supplier_name
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id
        JOIN suppliers s ON p.supplier_id = s.id
        WHERE pi.id = ?
    `).get(purchaseItemId);

    if (!pi) return null;

    const piBaseQty = (pi.base_quantity && pi.base_quantity > 0) ? pi.base_quantity : pi.quantity;

    const customerSales = targetDb.prepare(`
        SELECT 
            c.id as customer_id,
            c.name as customer_name,
            csi.unit as unit,
            SUM(a.quantity) as quantity,
            SUM(a.base_quantity) as base_quantity,
            cs.id as credit_sale_id,
            cs.invoice_number,
            cs.sale_date
        FROM sale_item_purchase_allocations a
        JOIN credit_sale_items csi ON a.sale_item_id = csi.id
        JOIN credit_sales cs ON csi.credit_sale_id = cs.id
        JOIN customers c ON cs.customer_id = c.id
        WHERE a.purchase_item_id = ? AND cs.status != 'CANCELLED'
        GROUP BY cs.id, c.id, csi.unit
        ORDER BY cs.sale_date DESC, cs.id DESC
    `).all(purchaseItemId);

    const totalSoldBaseQty = customerSales.reduce((acc, curr) => acc + (curr.base_quantity || 0), 0);
    const remainingBaseQty = Math.max(0, piBaseQty - totalSoldBaseQty);

    const soldQty = piBaseQty > 0 ? (totalSoldBaseQty / piBaseQty) * pi.quantity : totalSoldBaseQty;
    const remainingQty = Math.max(0, pi.quantity - soldQty);

    return {
        purchase_item_id: pi.id,
        item_name: pi.item_name,
        purchased_quantity: pi.quantity,
        purchased_unit: pi.unit,
        purchased_base_quantity: piBaseQty,
        purchased_base_unit: pi.base_unit || pi.unit,
        sold_quantity: Math.round(soldQty * 10000) / 10000,
        sold_base_quantity: Math.round(totalSoldBaseQty * 10000) / 10000,
        remaining_quantity: Math.round(remainingQty * 10000) / 10000,
        remaining_base_quantity: Math.round(remainingBaseQty * 10000) / 10000,
        customer_sales: customerSales.map(cs => ({
            customer_id: cs.customer_id,
            customer_name: cs.customer_name,
            quantity: Math.round(cs.quantity * 10000) / 10000,
            unit: cs.unit,
            base_quantity: Math.round(cs.base_quantity * 10000) / 10000,
            sale_date: cs.sale_date,
            credit_sale_id: cs.credit_sale_id,
            invoice_number: cs.invoice_number || `#${cs.credit_sale_id}`
        }))
    };
}

function backfillAllocations(customDb) {
    const targetDb = getDb(customDb);
    initSchema(targetDb);

    // Run backfill for all existing non-cancelled sales chronologically
    const sales = targetDb.prepare(`
        SELECT id FROM credit_sales 
        WHERE status != 'CANCELLED' 
        ORDER BY sale_date ASC, id ASC
    `).all();

    for (const sale of sales) {
        const items = targetDb.prepare("SELECT id FROM credit_sale_items WHERE credit_sale_id = ? AND (item_type IS NULL OR item_type != 'service')").all(sale.id);
        for (const item of items) {
            const hasAlloc = targetDb.prepare('SELECT COUNT(*) as count FROM sale_item_purchase_allocations WHERE sale_item_id = ?').get(item.id).count;
            if (hasAlloc === 0) {
                allocateSaleItemToPurchaseStock(item.id, targetDb);
            }
        }
    }
}

module.exports = {
    initSchema,
    allocateSaleItemToPurchaseStock,
    reallocateSale,
    getPurchaseItemAllocations,
    backfillAllocations
};
