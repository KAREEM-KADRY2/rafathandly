const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATHS = [
    path.resolve(__dirname, '../db/database.sqlite'),
    'C:\\Al-Hajj-Refaat\\backend\\src\\db\\database.sqlite',
    path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\Al-Hajj-Refaat-Client\\backend\\src\\db\\database.sqlite'),
    path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\لوجو\\backend\\src\\db\\database.sqlite')
];

console.log('=== CLEAN SLATE DATABASE RESET ===');

const TABLES_TO_TRUNCATE = [
    'customers',
    'suppliers',
    'supplier_items',
    'purchases',
    'purchase_items',
    'supplier_balance_transactions',
    'credit_sales',
    'credit_sale_items',
    'customer_payments',
    'customer_account_transactions',
    'opening_balances',
    'expenses',
    'workers',
    'worker_withdrawals',
    'worker_attendance',
    'other_expenses',
    'inventory_items',
    'inventory_movements',
    'treasury_transactions',
    'audit_logs',
    'services',
    'vehicles',
    'transport_trips',
    'freight_transactions',
    'customer_adjustments',
    'barsal_records'
];

for (const dbPath of DB_PATHS) {
    if (!fs.existsSync(dbPath)) {
        console.log(`[SKIP] File not found: ${dbPath}`);
        continue;
    }

    console.log(`\nCleaning Database: ${dbPath}`);
    const db = new Database(dbPath);
    
    // Enable PRAGMAs for safe mutation
    db.pragma('foreign_keys = OFF');

    const PRESERVED_TABLES = ['users', 'system_settings', 'company_settings', 'financial_periods', 'accounting_periods', 'financial_accounts', 'sqlite_sequence'];
    const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    const tablesToTruncate = allTables.filter(t => !PRESERVED_TABLES.includes(t));

    db.transaction(() => {
        for (const table of tablesToTruncate) {
            try {
                db.prepare(`DELETE FROM ${table}`).run();
                console.log(`  - Truncated table: ${table}`);
            } catch (err) {
                console.log(`  - Notice on table ${table}: ${err.message}`);
            }
        }

        // Reset financial accounts balances to 0
        try {
            db.prepare('UPDATE financial_accounts SET balance = 0').run();
            console.log('  - Reset financial_accounts balances to 0');
        } catch (e) {
            console.log('  - Notice on financial_accounts:', e.message);
        }

        // Clear autoincrement counters
        try {
            db.prepare('DELETE FROM sqlite_sequence').run();
            console.log('  - Cleared sqlite_sequence (reset autoincrement counters)');
        } catch (e) {
            console.log('  - Notice on sqlite_sequence:', e.message);
        }
    })();

    db.pragma('foreign_keys = ON');
    try {
        db.exec('VACUUM');
        console.log('  - Database VACUUM completed successfully');
    } catch (e) {
        console.log('  - Notice on VACUUM:', e.message);
    }

    // Verification
    const integrity = db.pragma('integrity_check')[0]?.integrity_check;
    const fkDetails = db.pragma('foreign_key_check');
    const fks = fkDetails.length;
    if (fks > 0) {
        console.log('  FK Violation Details:', JSON.stringify(fkDetails));
    }

    const custCount = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
    const suppCount = db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c;
    const workCount = db.prepare('SELECT COUNT(*) as c FROM workers').get().c;
    const salesCount = db.prepare('SELECT COUNT(*) as c FROM credit_sales').get().c;
    const purchCount = db.prepare('SELECT COUNT(*) as c FROM purchases').get().c;
    const expCount = db.prepare('SELECT COUNT(*) as c FROM expenses').get().c;
    const auditCount = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c;

    db.close();

    console.log(`  [VERIFICATION SUMMARY]`);
    console.log(`  Integrity: ${integrity}`);
    console.log(`  FK Violations: ${fks}`);
    console.log(`  Customers: ${custCount}`);
    console.log(`  Suppliers: ${suppCount}`);
    console.log(`  Workers: ${workCount}`);
    console.log(`  Sales: ${salesCount}`);
    console.log(`  Purchases: ${purchCount}`);
    console.log(`  Expenses: ${expCount}`);
    console.log(`  Audit Logs: ${auditCount}`);
}

console.log('\n=== CLEAN SLATE DATABASE RESET COMPLETED ===');
