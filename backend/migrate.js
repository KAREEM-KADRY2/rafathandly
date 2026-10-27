const db = require('./src/db/index.js');

try {
  // Create vehicles table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      plate_number TEXT,
      driver TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  console.log("Vehicles table created.");

  // Alter transport_trips table
  // Since it's empty, we can just alter table add column. Wait, sqlite allows ADD COLUMN.
  // We can also just recreate it if it's empty but let's check its schema first.
  db.prepare(`
    ALTER TABLE transport_trips ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id)
  `).run();
  console.log("transport_trips altered.");
} catch (e) {
  console.error(e);
}
