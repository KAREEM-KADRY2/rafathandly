const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'src', 'db', 'database.sqlite');
const db = new Database(dbPath, { verbose: console.log });

try {
    db.exec('BEGIN TRANSACTION');

    // 1. Drop existing treasury_transactions and financial_accounts
    db.exec('DROP TABLE IF EXISTS treasury_transactions');
    db.exec('DROP TABLE IF EXISTS financial_accounts');

    // 2. Create tables
    db.exec(`
        CREATE TABLE financial_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL CHECK(type IN ('CASH', 'BANK', 'EWALLET')),
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE treasury_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'TRANSFER')),
            amount REAL NOT NULL,
            date DATETIME NOT NULL,
            description TEXT,
            related_entity_type TEXT,
            related_entity_id INTEGER,
            user TEXT DEFAULT 'System',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES financial_accounts(id)
        )
    `);

    // 3. Insert default accounts
    const insertAccount = db.prepare('INSERT INTO financial_accounts (name, type, balance) VALUES (?, ?, ?)');
    const defaultAccounts = [
        { name: 'النقدي', type: 'CASH' },
        { name: 'CIB', type: 'BANK' },
        { name: 'البنك الأهلي', type: 'BANK' },
        { name: 'بنك مصر', type: 'BANK' },
        { name: 'المحافظ الإلكترونية', type: 'EWALLET' }
    ];

    for (const acc of defaultAccounts) {
        insertAccount.run(acc.name, acc.type, 0);
    }

    // 4. Map existing payment_methods to account_ids
    const getAccountByName = db.prepare('SELECT id FROM financial_accounts WHERE name = ?');
    const cashAccId = getAccountByName.get('النقدي').id;
    const cibAccId = getAccountByName.get('CIB').id;
    const ewalletAccId = getAccountByName.get('المحافظ الإلكترونية').id;
    
    function mapPaymentMethodToAccountId(method) {
        if (!method) return cashAccId;
        method = method.toLowerCase();
        if (method.includes('cib')) return cibAccId;
        if (method.includes('فودافون') || method.includes('اتصالات') || method.includes('محفظة') || method.includes('wallet')) return ewalletAccId;
        if (method.includes('بنك') || method.includes('bank')) return cibAccId; // Default bank to CIB if unclear
        return cashAccId; // Default
    }

    const insertTransaction = db.prepare(`
        INSERT INTO treasury_transactions (account_id, type, amount, date, description, related_entity_type, related_entity_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Migrate Customer Payments
    const custPayments = db.prepare('SELECT id, amount, payment_date as date, payment_method, notes FROM customer_payments').all();
    for (const p of custPayments) {
        insertTransaction.run(mapPaymentMethodToAccountId(p.payment_method), 'IN', p.amount, p.date, p.notes || 'سداد عميل', 'customer_payment', p.id);
    }

    // Migrate Supplier Payments (from supplier_balance_transactions where transaction_type = 'deposit')
    const supPayments = db.prepare("SELECT id, amount, created_at as date, description FROM supplier_balance_transactions WHERE transaction_type = 'deposit'").all();
    for (const p of supPayments) {
        insertTransaction.run(cashAccId, 'OUT', p.amount, p.date, p.description || 'سداد مورد', 'supplier_payment', p.id);
    }

    // Migrate Expenses
    const expenses = db.prepare('SELECT id, amount, expense_date as date, description FROM expenses').all();
    for (const e of expenses) {
        insertTransaction.run(cashAccId, 'OUT', e.amount, e.date, e.description || 'مصروفات سيارات', 'expense', e.id);
    }

    // Migrate Other Expenses
    const otherExpenses = db.prepare('SELECT id, amount, expense_date as date, description FROM other_expenses').all();
    for (const e of otherExpenses) {
        insertTransaction.run(cashAccId, 'OUT', e.amount, e.date, e.description || 'مصروفات أخرى', 'other_expense', e.id);
    }

    // Migrate Worker Withdrawals
    const workerWithdrawals = db.prepare('SELECT id, amount, withdrawal_date as date, description FROM worker_withdrawals').all();
    for (const w of workerWithdrawals) {
        insertTransaction.run(cashAccId, 'OUT', w.amount, w.date, w.description || 'سحب عامل', 'worker_withdrawal', w.id);
    }
    
    // Sum balances
    const accounts = db.prepare('SELECT id FROM financial_accounts').all();
    for (const acc of accounts) {
        const inSum = db.prepare("SELECT SUM(amount) as s FROM treasury_transactions WHERE account_id = ? AND type = 'IN'").get(acc.id).s || 0;
        const outSum = db.prepare("SELECT SUM(amount) as s FROM treasury_transactions WHERE account_id = ? AND type = 'OUT'").get(acc.id).s || 0;
        db.prepare("UPDATE financial_accounts SET balance = ? WHERE id = ?").run(inSum - outSum, acc.id);
    }

    db.exec('COMMIT');
    console.log('Migration completed successfully.');

} catch (err) {
    db.exec('ROLLBACK');
    console.error('Migration failed:', err);
}
