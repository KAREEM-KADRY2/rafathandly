const Database = require('better-sqlite3');
const db = new Database('src/db/database.sqlite');
const tableInfo = db.prepare("PRAGMA table_info('transport_trips')").all();
console.log(tableInfo);
const count = db.prepare("SELECT COUNT(*) as c FROM transport_trips").get().c;
console.log("Total records:", count);
