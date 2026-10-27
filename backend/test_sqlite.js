const Database = require('better-sqlite3');
const db = new Database('src/db/database.sqlite');
try {
    const res = db.prepare(`SELECT * FROM worker_attendance WHERE worker_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`).all(1, '10', '2026');
    console.log(res);
} catch(e) { console.error(e); }
