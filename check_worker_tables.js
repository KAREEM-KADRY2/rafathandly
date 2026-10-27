const db = require('./backend/src/db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('--- ALL TABLES REFERENCING WORKERS ---');
for (const t of tables) {
    try {
        const fks = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all();
        const matches = fks.filter(f => f.table === 'workers');
        if (matches.length > 0) {
            console.log(`Table "${t.name}" FK to workers:`, matches);
        }
        const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
        const workerCols = cols.filter(c => c.name.includes('worker'));
        if (workerCols.length > 0) {
            console.log(`Table "${t.name}" has columns:`, workerCols.map(c => c.name));
        }
    } catch (e) {
        console.error(`Error on ${t.name}:`, e.message);
    }
}
