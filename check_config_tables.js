const db = require('./backend/src/db');

console.log('users:', db.prepare('SELECT id, username, role FROM users').all());
console.log('financial_accounts:', db.prepare('SELECT * FROM financial_accounts').all());
console.log('financial_periods:', db.prepare('SELECT * FROM financial_periods').all());
console.log('partners:', db.prepare('SELECT * FROM partners').all());
console.log('system_settings sample:', db.prepare('SELECT * FROM system_settings LIMIT 5').all());
