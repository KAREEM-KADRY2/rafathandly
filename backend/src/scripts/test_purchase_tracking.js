const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const testDbPath = path.resolve(__dirname, '../db/test_purchase_tracking.db');
if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch(e){}
}
if (fs.existsSync(testDbPath + '-wal')) {
    try { fs.unlinkSync(testDbPath + '-wal'); } catch(e){}
}
if (fs.existsSync(testDbPath + '-shm')) {
    try { fs.unlinkSync(testDbPath + '-shm'); } catch(e){}
}

const db = new Database(testDbPath);
db.pragma('journal_mode = WAL');

const schemaPath = path.resolve(__dirname, '../db/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

const purchaseAllocationService = require('../services/purchaseAllocationService');
purchaseAllocationService.initSchema(db);

console.log('=== RUNNING PURCHASE ALLOCATION & CUSTOMER TRACKING INTEGRATION TESTS ===\n');

// 1. Setup Suppliers and Customers
const supplierId = db.prepare(`INSERT INTO suppliers (name, type) VALUES ('مورد أ', 'توريد مواد')`).run().lastInsertRowid;
const custAhmed = db.prepare(`INSERT INTO customers (name) VALUES ('أحمد')`).run().lastInsertRowid;
const custMohamed = db.prepare(`INSERT INTO customers (name) VALUES ('محمد')`).run().lastInsertRowid;
const custCompanyX = db.prepare(`INSERT INTO customers (name) VALUES ('شركة النور')`).run().lastInsertRowid;
const custY = db.prepare(`INSERT INTO customers (name) VALUES ('عميل Y')`).run().lastInsertRowid;

// Setup inventory item
db.prepare(`INSERT INTO inventory_items (name, unit, secondary_unit, conversion_factor) VALUES ('أسمنت', 'طن', 'شكارة', 20)`).run();

// 2. Create Purchase #1: 20 tons Cement
const pRes = db.prepare(`
    INSERT INTO purchases (supplier_id, invoice_number, total_amount, paid_amount, remaining_amount, purchase_date)
    VALUES (?, 'PUR-101', 100000, 100000, 0, '2026-10-01')
`).run(supplierId);
const purchaseId = pRes.lastInsertRowid;

const piRes = db.prepare(`
    INSERT INTO purchase_items (purchase_id, item_name, quantity, unit, base_quantity, base_unit, unit_price, total_price)
    VALUES (?, 'أسمنت', 20, 'طن', 20, 'طن', 5000, 100000)
`).run(purchaseId);
const purchaseItemId = piRes.lastInsertRowid;

console.log(`[TEST 1] Purchase Created: 20 tons Cement (PurchaseItemId: ${purchaseItemId})`);

// Initial Tracking check
let track = purchaseAllocationService.getPurchaseItemAllocations(purchaseItemId, db);
console.log(`Initial Status: Purchased = ${track.purchased_quantity} ${track.purchased_unit}, Sold = ${track.sold_quantity}, Remaining = ${track.remaining_quantity}`);
if (track.purchased_quantity === 20 && track.sold_quantity === 0 && track.remaining_quantity === 20) {
    console.log('✅ TEST 1 PASSED: Initial stock is 20 tons.\n');
} else {
    console.error('❌ TEST 1 FAILED');
    process.exit(1);
}

// 3. Create Sales: Ahmed (5 tons), Mohamed (3 tons), Company X (7 tons)
function createTestSale(customerId, qty, unit, unitPrice, saleDate, invoiceNo) {
    const sRes = db.prepare(`
        INSERT INTO credit_sales (customer_id, invoice_number, original_amount, paid_amount, remaining_amount, sale_date, due_date, status)
        VALUES (?, ?, ?, ?, 0, ?, ?, 'CONFIRMED')
    `).run(customerId, invoiceNo, qty * unitPrice, qty * unitPrice, saleDate, saleDate);
    const saleId = sRes.lastInsertRowid;

    const itemRes = db.prepare(`
        INSERT INTO credit_sale_items (credit_sale_id, item_type, item_name, quantity, unit, unit_price, total_price)
        VALUES (?, 'product', 'أسمنت', ?, ?, ?, ?)
    `).run(saleId, qty, unit, unitPrice, qty * unitPrice);

    purchaseAllocationService.allocateSaleItemToPurchaseStock(itemRes.lastInsertRowid, db);
    return saleId;
}

const saleAhmed = createTestSale(custAhmed, 5, 'طن', 5500, '2026-10-05', 'INV-1025');
const saleMohamed = createTestSale(custMohamed, 3, 'طن', 5500, '2026-10-06', 'INV-1031');
const saleCompX = createTestSale(custCompanyX, 7, 'طن', 5500, '2026-10-07', 'INV-1040');

console.log('[TEST 2] Recorded Sales: Ahmed (5t), Mohamed (3t), Company X (7t)');
track = purchaseAllocationService.getPurchaseItemAllocations(purchaseItemId, db);
console.log(`Updated Status: Purchased = ${track.purchased_quantity}, Sold = ${track.sold_quantity}, Remaining = ${track.remaining_quantity}`);

console.log('Customer Sales List:');
track.customer_sales.forEach(cs => console.log(`  - ${cs.customer_name}: ${cs.quantity} ${cs.unit} (Invoice: ${cs.invoice_number})`));

if (track.sold_quantity === 15 && track.remaining_quantity === 5 && track.customer_sales.length === 3) {
    console.log('✅ TEST 2 PASSED: 15 tons sold, 5 tons remaining, 3 customers linked.\n');
} else {
    console.error('❌ TEST 2 FAILED');
    process.exit(1);
}

// 4. New Sale: Customer Y buys 3 tons
const saleY = createTestSale(custY, 3, 'طن', 5500, '2026-10-08', 'INV-1045');
console.log('[TEST 3] Recorded Sale: Customer Y (3t)');
track = purchaseAllocationService.getPurchaseItemAllocations(purchaseItemId, db);
console.log(`Updated Status: Purchased = ${track.purchased_quantity}, Sold = ${track.sold_quantity}, Remaining = ${track.remaining_quantity}`);

if (track.sold_quantity === 18 && track.remaining_quantity === 2) {
    console.log('✅ TEST 3 PASSED: 18 tons sold, 2 tons remaining.\n');
} else {
    console.error('❌ TEST 3 FAILED');
    process.exit(1);
}

// 5. Sale Cancellation / Return: Ahmed's sale is cancelled or updated (e.g., Ahmed returns 2 tons -> updated to 3 tons)
console.log("[TEST 4] Ahmed's sale cancelled / updated (Ahmed returned 2 tons -> net 3 tons)");
// Cancel Ahmed's original sale
db.prepare(`UPDATE credit_sales SET status = 'CANCELLED' WHERE id = ?`).run(saleAhmed);
purchaseAllocationService.reallocateSale(saleAhmed, db);

// Re-create Ahmed's modified sale for 3 tons
createTestSale(custAhmed, 3, 'طن', 5500, '2026-10-05', 'INV-1025-MOD');

track = purchaseAllocationService.getPurchaseItemAllocations(purchaseItemId, db);
console.log(`Updated Status: Purchased = ${track.purchased_quantity}, Sold = ${track.sold_quantity}, Remaining = ${track.remaining_quantity}`);
console.log('Updated Customer Sales List:');
track.customer_sales.forEach(cs => console.log(`  - ${cs.customer_name}: ${cs.quantity} ${cs.unit} (Invoice: ${cs.invoice_number})`));

if (track.sold_quantity === 16 && track.remaining_quantity === 4) {
    console.log('✅ TEST 4 PASSED: Reversal/edit correctly updated sold to 16 tons, remaining to 4 tons.\n');
} else {
    console.error('❌ TEST 4 FAILED');
    process.exit(1);
}

// Clean up test DB
db.close();
try { fs.unlinkSync(testDbPath); } catch(e){}
console.log('🎉 ALL 4/4 INTEGRATION TESTS PASSED SUCCESSFULLY!');
