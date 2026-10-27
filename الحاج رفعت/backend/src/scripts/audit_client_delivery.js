const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DEV_DIR = path.resolve(__dirname, '../../../');
const CLIENT_DIR = 'C:\\Al-Hajj-Refaat';
const CLIENT_DESKTOP_DIR = path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\Al-Hajj-Refaat-Client');

console.log('====================================================');
console.log('=== CLIENT DELIVERY BUILD & SHORTCUT AUDIT ===');
console.log('====================================================');

console.log('Dev Workspace Dir:   ', DEV_DIR);
console.log('Client Install Dir:  ', CLIENT_DIR);
console.log('Client Desktop Copy: ', CLIENT_DESKTOP_DIR);

function getHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

// 1. COMPARE CODEFILES BETWEEN DEV & DELIVERY
console.log('\n--- 1. CODE COMPARISON CHECKLIST (DEV VS DELIVERY) ---');

const keyFilesToAudit = [
    'backend/src/db/index.js',
    'backend/src/controllers/customerController.js',
    'backend/src/controllers/supplierController.js',
    'backend/src/controllers/workerController.js',
    'backend/src/controllers/treasuryController.js',
    'backend/src/controllers/reportsV2Controller.js',
    'backend/src/controllers/settingsController.js',
    'backend/index.js'
];

const checklist = [];

for (const relPath of keyFilesToAudit) {
    const devPath = path.join(DEV_DIR, relPath);
    const clientPath = path.join(CLIENT_DIR, relPath);

    const devExists = fs.existsSync(devPath);
    const clientExists = fs.existsSync(clientPath);

    const devHash = getHash(devPath);
    const clientHash = getHash(clientPath);

    const isMatch = devExists && clientExists && (devHash === clientHash);

    checklist.push({
        file: relPath,
        devStatus: devExists ? 'Present' : 'Missing',
        deliveryStatus: clientExists ? 'Present' : 'Missing',
        syncStatus: isMatch ? 'IN SYNC (100% Latest)' : 'OUT OF SYNC',
        evidence: `Dev Hash: ${devHash ? devHash.substring(0, 8) : 'N/A'} | Delivery Hash: ${clientHash ? clientHash.substring(0, 8) : 'N/A'}`
    });
}

console.table(checklist);

// 2. VERIFY PRODUCTION DATABASE PATH & INTEGRITY IN DELIVERY FOLDER
console.log('\n--- 2. CLIENT PRODUCTION DATABASE AUDIT ---');
const clientDbPath = path.join(CLIENT_DIR, 'backend/src/db/database.sqlite');
console.log('Client Delivery DB Path:', clientDbPath);

if (!fs.existsSync(clientDbPath)) {
    console.error('ERROR: Delivery database file missing at', clientDbPath);
} else {
    const dbSize = fs.statSync(clientDbPath).size;
    console.log(`Client Database Size: ${(dbSize / 1024).toFixed(2)} KB`);

    const cDb = new Database(clientDbPath);
    const integrity = cDb.pragma('integrity_check')[0]?.integrity_check;
    const fks = cDb.pragma('foreign_key_check').length;

    const counts = {
        customers: cDb.prepare('SELECT COUNT(*) as c FROM customers').get().c,
        suppliers: cDb.prepare('SELECT COUNT(*) as c FROM suppliers').get().c,
        workers: cDb.prepare('SELECT COUNT(*) as c FROM workers').get().c,
        sales: cDb.prepare('SELECT COUNT(*) as c FROM credit_sales').get().c,
        purchases: cDb.prepare('SELECT COUNT(*) as c FROM purchases').get().c,
        financial_accounts: cDb.prepare('SELECT COUNT(*) as c FROM financial_accounts').get().c
    };

    cDb.close();

    console.log(`Integrity Check: ${integrity} | FK Violations: ${fks}`);
    console.log('Client Record Counts:', counts);
    console.log(`Stress Test DB In Use? ${clientDbPath.includes('stress') ? 'YES (DANGEROUS)' : 'NO (SAFE)'}`);
}

// 3. LAUNCHER & SHORTCUT AUDIT
console.log('\n--- 3. LAUNCHER FILES & DESKTOP SHORTCUT AUDIT ---');
const launcherFiles = [
    'Start-AlHajjRefaat.exe',
    'Create-Desktop-Shortcut.exe',
    'Stop-AlHajjRefaat.exe',
    'Start-System.bat',
    'README-CLIENT.txt'
];

for (const lf of launcherFiles) {
    const p1 = path.join(CLIENT_DIR, lf);
    const p2 = path.join(CLIENT_DESKTOP_DIR, lf);
    console.log(`Launcher File [${lf}]: \`C:\\Al-Hajj-Refaat\` = ${fs.existsSync(p1) ? 'OK' : 'MISSING'} | \`Desktop Copy\` = ${fs.existsSync(p2) ? 'OK' : 'MISSING'}`);
}
