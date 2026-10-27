const fs = require('fs');
const Database = require('./backend/node_modules/better-sqlite3');

const sourceDb = 'C:/Users/xps/Desktop/الحاج رفعت/backend/src/db/database.sqlite';
const cleanDbPath = 'C:/Users/xps/Desktop/clean_database.sqlite';

if (fs.existsSync(cleanDbPath)) fs.unlinkSync(cleanDbPath);
fs.copyFileSync(sourceDb, cleanDbPath);

const db = new Database(cleanDbPath);
db.pragma('foreign_keys = OFF');

const tablesToTruncate = [
    'customers',
    'customer_account_transactions',
    'customer_payments',
    'customer_adjustments',
    'customer_item_prices',
    'credit_sales',
    'credit_sale_items',
    'sale_item_purchase_allocations',
    'suppliers',
    'supplier_items',
    'purchases',
    'purchase_items',
    'supplier_balance_transactions',
    'transport_trips',
    'freight_transactions',
    'inventory_items',
    'inventory_movements',
    'barsal_records',
    'expenses',
    'other_expenses',
    'services',
    'vehicles',
    'workers',
    'worker_withdrawals',
    'worker_attendance',
    'worker_leaves',
    'partner_transactions',
    'partners',
    'opening_balances',
    'audit_logs',
    'treasury_transactions'
];

console.log('--- TRUNCATING BUSINESS TABLES ---');
for (const table of tablesToTruncate) {
    try {
        const info = db.prepare(`DELETE FROM "${table}"`).run();
        console.log(`Cleared ${table}: ${info.changes} rows removed`);
    } catch (e) {
        console.error(`Error clearing ${table}:`, e.message);
    }
}

// Reset financial account balances to 0
const faInfo = db.prepare('UPDATE financial_accounts SET balance = 0').run();
console.log(`Reset financial_accounts balances to 0: ${faInfo.changes} accounts updated`);

// Reset sqlite_sequence
try {
    db.prepare('DELETE FROM sqlite_sequence').run();
    console.log('Reset sqlite_sequence counters');
} catch (e) {
    console.log('No sqlite_sequence table or reset not needed');
}

// Verify foreign keys & integrity
db.pragma('foreign_keys = ON');
const fkCheck = db.pragma('foreign_key_check');
console.log('Foreign key check violations:', fkCheck.length);
if (fkCheck.length > 0) {
    console.error('VIOLATIONS:', fkCheck);
}

const integrity = db.pragma('integrity_check');
console.log('Integrity check:', integrity);

// Check remaining tables and counts
const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log('\n--- FINAL RECORD COUNTS IN CLEAN DATABASE ---');
for (const t of allTables) {
    const c = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get().cnt;
    console.log(`  ${t.name}: ${c}`);
}

db.close();

// VACUUM with fresh connection
const dbVacuum = new Database(cleanDbPath);
dbVacuum.exec('VACUUM');
dbVacuum.close();

console.log('\nClean database successfully created at:', cleanDbPath);
console.log('File size:', (fs.statSync(cleanDbPath).size / 1024).toFixed(2), 'KB');
