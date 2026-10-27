const db = require('./backend/src/db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('--- ALL FOREIGN KEYS IN DATABASE ---');
for (const t of tables) {
    try {
        const fks = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all();
        if (fks.length > 0) {
            console.log(`Table "${t.name}":`, fks.map(f => `${f.from} -> ${f.table}(${f.to}) [ON DELETE ${f.on_delete}]`));
        }
    } catch (e) {}
}
