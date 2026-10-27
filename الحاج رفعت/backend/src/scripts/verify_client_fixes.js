const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const clientDirs = [
    'C:\\Al-Hajj-Refaat',
    path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\Al-Hajj-Refaat-Client'),
    path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\لوجو')
];

console.log('=== CLIENT PACKAGE VERIFICATION ===');
clientDirs.forEach(dir => {
    console.log(`\nInspecting Package: ${dir}`);
    if (!fs.existsSync(dir)) {
        console.log('  Directory does not exist.');
        return;
    }

    const distIndex = path.join(dir, 'dist', 'index.html');
    const frontendDistIndex = path.join(dir, 'frontend', 'dist', 'index.html');
    const customerCtrl = path.join(dir, 'backend', 'src', 'controllers', 'customerController.js');
    const dbFile = path.join(dir, 'backend', 'src', 'db', 'database.sqlite');

    console.log(`  dist/index.html exists: ${fs.existsSync(distIndex)}`);
    console.log(`  frontend/dist/index.html exists: ${fs.existsSync(frontendDistIndex)}`);
    
    // Check if customerController has the ?all=true / non-paginated backward compat
    if (fs.existsSync(customerCtrl)) {
        const ctrlCode = fs.readFileSync(customerCtrl, 'utf8');
        const hasBackwardCompat = ctrlCode.includes("req.query.all === 'true'") || ctrlCode.includes("!page && !limit && !search");
        console.log(`  customerController backward compatibility: ${hasBackwardCompat ? 'VERIFIED ✓' : 'MISSING ✗'}`);
    } else {
        console.log(`  customerController: NOT FOUND ✗`);
    }

    // Check frontend build asset
    const assetsDir = path.join(dir, 'dist', 'assets');
    if (fs.existsSync(assetsDir)) {
        const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
        console.log(`  dist/assets JS bundle: ${jsFiles.join(', ')}`);
    }

    // Check database
    if (fs.existsSync(dbFile)) {
        try {
            const db = new Database(dbFile);
            const tables = db.prepare("SELECT count(1) as count FROM sqlite_master WHERE type='table'").get().count;
            const customers = db.prepare("SELECT count(1) as count FROM customers").get().count;
            const vehicles = db.prepare("SELECT count(1) as count FROM vehicles").get().count;
            const sales = db.prepare("SELECT count(1) as count FROM credit_sales").get().count;
            db.close();
            console.log(`  database.sqlite: ${tables} tables, ${customers} customers, ${vehicles} vehicles, ${sales} sales`);
        } catch (e) {
            console.log(`  database error: ${e.message}`);
        }
    } else {
        console.log(`  database.sqlite: NOT FOUND`);
    }
});
