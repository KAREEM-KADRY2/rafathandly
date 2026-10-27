const db = require('./backend/src/db');

console.log('Workers:', db.prepare('SELECT * FROM workers').all());
console.log('Worker withdrawals:', db.prepare('SELECT * FROM worker_withdrawals').all());
console.log('Worker attendance:', db.prepare('SELECT * FROM worker_attendance').all());
console.log('Worker leaves:', db.prepare('SELECT * FROM worker_leaves').all());

// Check if any expenses or treasury records reference workers:
const expenses = db.prepare("SELECT * FROM expenses WHERE notes LIKE '%عامل%' OR category LIKE '%عامل%' OR category LIKE '%عمال%' OR category LIKE '%سلف%' OR category LIKE '%مرتب%'").all();
console.log('Related expenses:', expenses);
