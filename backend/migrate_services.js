const db = require('./src/db/index');
db.exec("CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, default_price REAL DEFAULT 0, cost_price REAL DEFAULT 0, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);");
try { db.exec("ALTER TABLE credit_sale_items ADD COLUMN item_type TEXT DEFAULT 'product'"); console.log('item_type added'); } catch (e) { console.log(e.message); }
try { db.exec("ALTER TABLE credit_sale_items ADD COLUMN service_id INTEGER"); console.log('service_id added'); } catch (e) { console.log(e.message); }
