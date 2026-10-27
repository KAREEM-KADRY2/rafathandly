const Database = require('better-sqlite3');
const db = new Database('src/db/database.sqlite');
const createStmt = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='worker_attendance'").get();
console.log('CREATE:', createStmt);
