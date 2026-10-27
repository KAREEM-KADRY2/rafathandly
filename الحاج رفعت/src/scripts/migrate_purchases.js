const db = require('../db');

console.log('Starting migration...');

db.transaction(() => {
    // 1. Add paid_amount and remaining_amount to purchases
    try {
        db.prepare('ALTER TABLE purchases ADD COLUMN paid_amount REAL DEFAULT 0').run();
        console.log('Added paid_amount to purchases');
    } catch (e) { console.log('paid_amount already exists or error:', e.message); }
    
    try {
        db.prepare('ALTER TABLE purchases ADD COLUMN remaining_amount REAL DEFAULT 0').run();
        // Update remaining_amount to be equal to total_amount for existing purchases
        db.prepare('UPDATE purchases SET remaining_amount = total_amount').run();
        console.log('Added remaining_amount to purchases');
    } catch (e) { console.log('remaining_amount already exists or error:', e.message); }

    // 2. Create supplier_payments
    db.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        purchase_id INTEGER,
        amount REAL NOT NULL,
        payment_date DATETIME NOT NULL,
        payment_method TEXT,
        reference_number TEXT,
        notes TEXT,
        recorded_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    )
    `).run();
    console.log('Created supplier_payments table');

    // 3. Create supplier_account_transactions (the ledger)
    db.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_account_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        purchase_id INTEGER,
        payment_id INTEGER,
        nawlon_trip_id INTEGER,
        transaction_type TEXT NOT NULL, -- 'PURCHASE', 'PAYMENT', 'NOLON', 'ADJUSTMENT'
        amount REAL NOT NULL, -- positive for debt increase (purchase), negative for debt reduction (payment)
        balance_after REAL NOT NULL,
        transaction_date DATETIME NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
        FOREIGN KEY (payment_id) REFERENCES supplier_payments(id) ON DELETE SET NULL,
        FOREIGN KEY (nawlon_trip_id) REFERENCES transport_trips(id) ON DELETE SET NULL
    )
    `).run();
    console.log('Created supplier_account_transactions table');

})();

console.log('Migration completed successfully!');
