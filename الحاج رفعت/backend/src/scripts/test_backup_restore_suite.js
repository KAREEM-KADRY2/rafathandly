const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const db = require('../db');
const backupService = require('../services/backupService');

console.log('===========================================================');
console.log('=== COMPREHENSIVE BACKUP & RESTORE AUTOMATED TEST SUITE ===');
console.log('===========================================================');

// 1. Setup isolated disposable test database
const TEST_DB_PATH = path.resolve(__dirname, '../db/company_accounts_test_backup.db');
if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch(e){}
    try { fs.unlinkSync(`${TEST_DB_PATH}-wal`); } catch(e){}
    try { fs.unlinkSync(`${TEST_DB_PATH}-shm`); } catch(e){}
}

console.log(`\nInitializing isolated test database: ${TEST_DB_PATH}`);
db.switchDatabase(TEST_DB_PATH);

// Seed test data into disposable test database
const testDb = db.getRawInstance();
testDb.exec(`
    INSERT INTO customers (id, name, phone) VALUES (101, 'عميل اختبار الباك اب - شركة النور', '01011112222');
    INSERT INTO suppliers (id, name, type, balance) VALUES (201, 'مورد اختبار - المعتمد للتوريدات', 'توريد مواد', 15000);
    INSERT INTO workers (id, name, monthly_salary) VALUES (301, 'عامل اختبار - أحمد محمود', 4500);
    INSERT INTO credit_sales (id, customer_id, invoice_number, original_amount, paid_amount, remaining_amount, sale_date, due_date) VALUES (401, 101, 'INV-TEST-001', 25000, 5000, 20000, '2026-10-09', '2026-10-15');
    INSERT INTO purchases (id, supplier_id, invoice_number, total_amount, paid_amount, remaining_amount, purchase_date) VALUES (501, 201, 'PUR-TEST-001', 30000, 15000, 15000, '2026-10-09');
    INSERT INTO inventory_items (id, name, unit, secondary_unit, conversion_factor) VALUES (601, 'أسمنت ممتاز اختبار', 'طن', 'شكارة', 20);
    INSERT INTO financial_accounts (id, name, type, balance) VALUES (701, 'خزينة اختبار فرعية', 'CASH', 50000);
`);

console.log('Test data seeded successfully into disposable database.');

let results = [];

function runTest(testName, testFn) {
    try {
        console.log(`\n[TEST] Running: ${testName}...`);
        testFn();
        console.log(`[PASS] ${testName}`);
        results.push({ name: testName, status: 'PASS' });
    } catch (err) {
        console.error(`[FAIL] ${testName}: ${err.message}`);
        results.push({ name: testName, status: 'FAIL', error: err.message });
    }
}

// TEST 1: Create Backup
let createdBackupResult = null;
runTest('1. Creating a backup via backupService.createBackup()', () => {
    createdBackupResult = backupService.createBackup('اختبار إنشاء نسخة يدوية');
    if (!createdBackupResult || !createdBackupResult.success) {
        throw new Error('createBackup did not return success');
    }
    if (!fs.existsSync(createdBackupResult.path)) {
        throw new Error('Created backup file does not exist on disk');
    }
    console.log(`  Backup created at: ${createdBackupResult.path}`);
    console.log(`  Size: ${createdBackupResult.sizeMB} MB`);
});

// TEST 2: Validate Backup
runTest('2. Validating the created backup file structure and schema', () => {
    const val = backupService.validateBackupFile(createdBackupResult.path);
    if (!val.valid) {
        throw new Error(`Validation failed: ${val.error}`);
    }
    if (val.recordsSummary.customers < 1 || val.recordsSummary.suppliers < 1) {
        throw new Error('Validation summary missing expected record counts');
    }
    console.log(`  Integrity: OK | Tables found: ${val.tablesCount}`);
});

// TEST 3: Restore into Disposable Database
runTest('3. Restoring backup into disposable test database', () => {
    const restoreRes = backupService.restoreBackup(createdBackupResult.path, 'مستخدم الاختبار');
    if (!restoreRes.success) {
        throw new Error('restoreBackup did not return success');
    }
    
    // Verify restored records
    const custCount = db.prepare('SELECT COUNT(*) as c FROM customers WHERE id = 101').get().c;
    const suppCount = db.prepare('SELECT COUNT(*) as c FROM suppliers WHERE id = 201').get().c;
    if (custCount !== 1 || suppCount !== 1) {
        throw new Error('Restored database does not contain expected seeded test records');
    }
});

// TEST 4: USB-style Path with Spaces
runTest('4. Restoring from a USB-style path containing spaces', () => {
    const usbDir = path.resolve(__dirname, '../../backups/USB Drive External Path Test/Sub Folder');
    fs.mkdirSync(usbDir, { recursive: true });
    const usbPath = path.join(usbDir, 'AlHajjRefaat_Backup_USB_Test_2026.db');
    
    fs.copyFileSync(createdBackupResult.path, usbPath);
    
    const restoreRes = backupService.restoreBackup(usbPath, 'اختبار USB');
    if (!restoreRes.success) {
        throw new Error('Failed to restore from USB path with spaces');
    }
    console.log(`  Successfully restored from USB path: ${usbPath}`);
});

// TEST 5: Arabic Filenames & Paths
runTest('5. Handling Arabic filenames and paths', () => {
    const arabicDir = path.resolve(__dirname, '../../backups/نسخ_احتياطية_مجلد_عربي/اختبارات');
    fs.mkdirSync(arabicDir, { recursive: true });
    const arabicPath = path.join(arabicDir, 'نسخة_احتياطية_شركة_النور_2026.db');
    
    fs.copyFileSync(createdBackupResult.path, arabicPath);
    
    const val = backupService.validateBackupFile(arabicPath);
    if (!val.valid) throw new Error(`Failed to validate Arabic path: ${val.error}`);
    
    const restoreRes = backupService.restoreBackup(arabicPath, 'اختبار مجلد عربي');
    if (!restoreRes.success) throw new Error('Failed to restore from Arabic path');
    console.log(`  Successfully validated & restored Arabic path: ${arabicPath}`);
});

// TEST 6: Rejecting Invalid File (e.g. text file)
runTest('6. Rejecting an invalid file (non-SQLite text file)', () => {
    const invalidPath = path.resolve(__dirname, '../../backups/invalid_dummy.db');
    fs.writeFileSync(invalidPath, 'This is a text file, not a sqlite database!');
    
    const val = backupService.validateBackupFile(invalidPath);
    if (val.valid) {
        throw new Error('Validation should have failed for non-SQLite file');
    }
    
    let caughtError = false;
    try {
        backupService.restoreBackup(invalidPath);
    } catch(err) {
        caughtError = true;
        console.log(`  Correctly caught rejection: ${err.message}`);
    }
    if (!caughtError) throw new Error('restoreBackup should have thrown error');
});

// TEST 7: Rejecting Corrupted SQLite File
runTest('7. Rejecting a corrupted SQLite file', () => {
    const corruptPath = path.resolve(__dirname, '../../backups/corrupted_sqlite.db');
    const validBuf = fs.readFileSync(createdBackupResult.path);
    // Corrupt header / middle data
    const corruptBuf = Buffer.from(validBuf);
    corruptBuf.fill(0xFF, 100, 500);
    fs.writeFileSync(corruptPath, corruptBuf);
    
    const val = backupService.validateBackupFile(corruptPath);
    if (val.valid) {
        throw new Error('Validation should have failed for corrupted SQLite file');
    }
    
    let caughtError = false;
    try {
        backupService.restoreBackup(corruptPath);
    } catch(err) {
        caughtError = true;
        console.log(`  Correctly caught corruption rejection: ${err.message}`);
    }
    if (!caughtError) throw new Error('restoreBackup should have thrown error');
});

// TEST 8: Handling Missing File
runTest('8. Handling a missing backup file', () => {
    const missingPath = path.resolve(__dirname, '../../backups/non_existent_file_999.db');
    const val = backupService.validateBackupFile(missingPath);
    if (val.valid) throw new Error('Validation should fail for missing file');
    
    let caughtError = false;
    try {
        backupService.restoreBackup(missingPath);
    } catch(e) {
        caughtError = true;
    }
    if (!caughtError) throw new Error('restoreBackup should fail for missing file');
});

// TEST 9: Pre-restore Safety Backup Verification
runTest('9. Verification of pre-restore safety backup creation', () => {
    const preRestoreFiles = fs.readdirSync(path.resolve(__dirname, '../../backups/pre_restore'));
    if (preRestoreFiles.length === 0) {
        throw new Error('Pre-restore safety backups folder is empty!');
    }
    console.log(`  Found ${preRestoreFiles.length} safety backups in pre_restore folder.`);
});

// TEST 10: Original Database Preserved If Restore Fails
runTest('10. Confirming original database is preserved if restoration fails', () => {
    const corruptPath = path.resolve(__dirname, '../../backups/corrupted_sqlite.db');
    
    // Check record count before failed restore
    const countBefore = db.prepare('SELECT COUNT(*) as c FROM customers WHERE id = 101').get().c;
    
    try {
        backupService.restoreBackup(corruptPath);
    } catch(e){}

    const countAfter = db.prepare('SELECT COUNT(*) as c FROM customers WHERE id = 101').get().c;
    if (countBefore !== countAfter) {
        throw new Error('Original database was corrupted or mutated during failed restore attempt');
    }
    console.log('  Original DB untouched after failed restore attempt.');
});

// TEST 11: Application Restart Data Persistence
runTest('11. Preserving data after database connection restart', () => {
    db.closeConnection();
    db.initDb(TEST_DB_PATH);
    const count = db.prepare('SELECT COUNT(*) as c FROM customers WHERE id = 101').get().c;
    if (count !== 1) throw new Error('Data lost after connection restart');
    console.log('  Data verified after connection re-initialization.');
});

// TEST 12: Confirming Correct Database Path Used
runTest('12. Confirming correct active database path is reported', () => {
    const activePath = db.getActiveDatabasePath();
    if (activePath !== TEST_DB_PATH) {
        throw new Error(`Reported active path (${activePath}) does not match expected (${TEST_DB_PATH})`);
    }
});

// TEST 13: Restored Database Contains Correct Financial & Inventory Balances
runTest('13. Confirming restored database contains correct financial & inventory balances', () => {
    const suppBal = db.prepare('SELECT balance FROM suppliers WHERE id = 201').get().balance;
    const finBal = db.prepare('SELECT balance FROM financial_accounts WHERE id = 701').get().balance;
    const invConv = db.prepare('SELECT conversion_factor FROM inventory_items WHERE id = 601').get().conversion_factor;

    if (suppBal !== 15000) throw new Error(`Supplier balance mismatch: expected 15000, got ${suppBal}`);
    if (finBal !== 50000) throw new Error(`Financial account balance mismatch: expected 50000, got ${finBal}`);
    if (invConv !== 20) throw new Error(`Inventory conversion factor mismatch: expected 20, got ${invConv}`);
    console.log(`  Verified balances: Supplier=${suppBal}, Treasury=${finBal}, InvConversion=${invConv}`);
});

// TEST 14: Integrity & Foreign Key Check
runTest('14. Final SQLite integrity and foreign-key check', () => {
    const rawInstance = db.getRawInstance();
    const integrity = rawInstance.pragma('integrity_check')[0]?.integrity_check;
    const fks = rawInstance.pragma('foreign_key_check').length;

    if (integrity !== 'ok') throw new Error(`Integrity check failed: ${integrity}`);
    console.log(`  Integrity: ${integrity} | FK Violations: ${fks}`);
});

// Cleanup test DB
db.closeConnection();
try { fs.unlinkSync(TEST_DB_PATH); } catch(e){}
try { fs.unlinkSync(`${TEST_DB_PATH}-wal`); } catch(e){}
try { fs.unlinkSync(`${TEST_DB_PATH}-shm`); } catch(e){}

// Switch back to standard db
const prodDbPath = path.resolve(__dirname, '../db/database.sqlite');
db.initDb(prodDbPath);

console.log('\n===========================================================');
console.log('=== BACKUP & RESTORE TEST SUITE RESULTS SUMMARY ===');
console.log('===========================================================');
console.table(results);

const failedCount = results.filter(r => r.status === 'FAIL').length;
if (failedCount > 0) {
    console.error(`\nFAILED: ${failedCount} tests failed.`);
    process.exit(1);
} else {
    console.log('\nSUCCESS: All 14 test cases passed successfully!');
    process.exit(0);
}
