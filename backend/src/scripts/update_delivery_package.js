const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DEV_DIR = path.resolve(__dirname, '../../../');
const TARGET_DIRS = [
    'C:\\Al-Hajj-Refaat',
    path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\Al-Hajj-Refaat-Client')
];
const logoDir = path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\لوجو');
if (fs.existsSync(logoDir)) {
    TARGET_DIRS.push(logoDir);
}

console.log('=== UPDATING CLIENT DELIVERY PACKAGES ===');
console.log('Source Workspace:', DEV_DIR);

function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.name === 'database.sqlite' || entry.name.includes('.sqlite') || entry.name.includes('.db') || entry.name.endsWith('-shm') || entry.name.endsWith('-wal')) {
            console.log(`[SKIP DB FILE] Skipping database copy for ${entry.name}`);
            continue;
        }
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'scratch') continue;
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

for (const targetDir of TARGET_DIRS) {
    if (!fs.existsSync(targetDir)) {
        console.log(`Target dir ${targetDir} does not exist. Creating...`);
        fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`\nSyncing to target directory: ${targetDir}`);

    // Safety backup of existing client database
    const clientDbFile = path.join(targetDir, 'backend/src/db/database.sqlite');
    if (fs.existsSync(clientDbFile)) {
        const bakFile = path.join(targetDir, 'backend/src/db/database.sqlite.bak');
        fs.copyFileSync(clientDbFile, bakFile);
        console.log(`  [SAFETY BACKUP] Backed up client database to: ${bakFile}`);
    }

    // Copy backend source files
    const devBackendSrc = path.join(DEV_DIR, 'backend/src');
    const targetBackendSrc = path.join(targetDir, 'backend/src');
    copyDirSync(devBackendSrc, targetBackendSrc);

    // Copy backend root index.js
    fs.copyFileSync(path.join(DEV_DIR, 'backend/index.js'), path.join(targetDir, 'backend/index.js'));

    // Copy frontend dist build artifact
    const devFrontendDist = path.join(DEV_DIR, 'frontend/dist');
    const targetFrontendDist = path.join(targetDir, 'frontend/dist');
    const targetRootDist = path.join(targetDir, 'dist');
    copyDirSync(devFrontendDist, targetFrontendDist);
    copyDirSync(devFrontendDist, targetRootDist);

    console.log(`  [SYNC COMPLETE] ${targetDir} updated successfully.`);
}

console.log('\n=== VERIFYING CLIENT DATABASE INTEGRITY AFTER SYNC ===');
for (const targetDir of TARGET_DIRS) {
    const clientDbFile = path.join(targetDir, 'backend/src/db/database.sqlite');
    if (fs.existsSync(clientDbFile)) {
        const db = new Database(clientDbFile);
        const integrity = db.pragma('integrity_check')[0]?.integrity_check;
        const fks = db.pragma('foreign_key_check').length;
        const custCount = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
        const suppCount = db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c;
        const salesCount = db.prepare('SELECT COUNT(*) as c FROM credit_sales').get().c;
        db.close();

        console.log(`\nLocation [${targetDir}]:`);
        console.log(`  Database Size: ${(fs.statSync(clientDbFile).size / 1024).toFixed(2)} KB`);
        console.log(`  Integrity Check: ${integrity}`);
        console.log(`  FK Violations: ${fks}`);
        console.log(`  Preserved Record Counts: Customers=${custCount}, Suppliers=${suppCount}, Sales=${salesCount}`);
    }
}
