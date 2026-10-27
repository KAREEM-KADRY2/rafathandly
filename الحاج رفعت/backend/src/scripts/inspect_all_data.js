const Database = require('../../../backend/node_modules/better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbs = [
    { name: 'Workspace DB', path: path.resolve(__dirname, '../db/database.sqlite') },
    { name: 'Client Package DB', path: path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\Al-Hajj-Refaat-Client\\backend\\src\\db\\database.sqlite') },
    { name: 'Logo / Test DB', path: path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop\\لوجو\\backend\\src\\db\\database.sqlite') },
    { name: 'C: Install DB', path: 'C:\\Al-Hajj-Refaat\\backend\\src\\db\\database.sqlite' }
];

dbs.forEach(item => {
    console.log(`\n========================================`);
    console.log(`INSPECTING: ${item.name} (${item.path})`);
    if (!fs.existsSync(item.path)) {
        console.log('File does not exist.');
        return;
    }

    const db = new Database(item.path);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    
    tables.forEach(t => {
        try {
            const count = db.prepare(`SELECT count(*) as c FROM ${t.name}`).get().c;
            if (count > 0) {
                console.log(`  Table [${t.name}]: ${count} records`);
                if (['customers', 'suppliers', 'inventory_items', 'vehicles', 'workers', 'credit_sales', 'purchases'].includes(t.name)) {
                    const rows = db.prepare(`SELECT * FROM ${t.name} LIMIT 3`).all();
                    console.log(`    Sample:`, rows.map(r => r.name || r.id));
                }
            }
        } catch(e) {
            console.log(`  Table [${t.name}]: error ${e.message}`);
        }
    });

    db.close();
});
