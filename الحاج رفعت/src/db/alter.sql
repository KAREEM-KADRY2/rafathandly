ALTER TABLE suppliers ADD COLUMN total_nawlon REAL DEFAULT 0;  
ALTER TABLE suppliers ADD COLUMN collected_nawlon REAL DEFAULT 0;  
ALTER TABLE transport_trips ADD COLUMN supplier_id INTEGER;  
ALTER TABLE transport_trips ADD COLUMN collected_amount REAL DEFAULT 0;  
ALTER TABLE transport_trips ADD COLUMN payment_status TEXT DEFAULT '?????'; 
CREATE TABLE IF NOT EXISTS freight_transactions ( id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, supplier_id INTEGER, amount REAL NOT NULL, payment_method TEXT, collection_date DATETIME, reference_number TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (trip_id) REFERENCES transport_trips(id) ON DELETE CASCADE, FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE ); 
