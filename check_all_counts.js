const db = require('./backend/src/db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log('--- RECORD COUNTS IN CURRENT DATABASE ---');
for (const t of tables) {
    try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get().count;
        console.log(`${t.name}: ${count}`);
    } catch (e) {
        console.error(`${t.name}: Error - ${e.message}`);
    }
}
