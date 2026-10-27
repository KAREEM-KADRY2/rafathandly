const db = require('./index.js');
const fs = require('fs');
const path = require('path');

const alterScript = fs.readFileSync(path.join(__dirname, 'alter.sql'), 'utf-8');

try {
  db.exec(alterScript);
  console.log('Database altered successfully.');
} catch (e) {
  console.error('Error altering DB or already altered:', e.message);
}
