const Database = require('C:/Users/xps/Desktop/الحاج رفعت/الحاج رفعت/backend/node_modules/better-sqlite3');

const dbs = [
    { name: 'Workspace DB', path: 'C:/Users/xps/Desktop/الحاج رفعت/الحاج رفعت/backend/src/db/database.sqlite' },
    { name: 'Client Folder DB', path: 'C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت/backend/src/db/database.sqlite' },
    { name: 'Khas Folder DB', path: 'C:/Users/xps/Desktop/خاص/الحاج رفعت/backend/src/db/database.sqlite' }
];

for (const item of dbs) {
    try {
        const db = new Database(item.path, { readonly: true });
        const custCount = db.prepare('SELECT count(*) as c FROM customers').get().c;
        const suppCount = db.prepare('SELECT count(*) as c FROM suppliers').get().c;
        const salesCount = db.prepare('SELECT count(*) as c FROM credit_sales').get().c;
        console.log(`[${item.name}]: Customers=${custCount}, Suppliers=${suppCount}, Sales=${salesCount}`);
        db.close();
    } catch (e) {
        console.log(`[${item.name}]: Error: ${e.message}`);
    }
}
