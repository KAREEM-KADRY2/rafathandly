const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'database.sqlite');
const schemaPath = path.resolve(__dirname, 'schema.sql');

function runMigrations(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS financial_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL CHECK(type IN ('CASH', 'BANK', 'EWALLET')),
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const faCount = db.prepare('SELECT COUNT(*) as count FROM financial_accounts').get().count;
    if (faCount === 0) {
        const insertFA = db.prepare('INSERT OR IGNORE INTO financial_accounts (id, name, type, balance) VALUES (?, ?, ?, 0)');
        insertFA.run(1, 'النقدي', 'CASH');
        insertFA.run(2, 'CIB', 'BANK');
        insertFA.run(3, 'البنك الأهلي', 'BANK');
        insertFA.run(4, 'بنك مصر', 'BANK');
        insertFA.run(5, 'المحافظ الإلكترونية', 'EWALLET');
    }

    const ttCols = db.prepare("PRAGMA table_info(treasury_transactions)").all().map(c => c.name);
    if (ttCols.length > 0 && !ttCols.includes('account_id')) {
        db.exec(`
            ALTER TABLE treasury_transactions RENAME TO treasury_transactions_old;
            
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
            );
        `);

        const oldRows = db.prepare('SELECT * FROM treasury_transactions_old').all();
        const insertTT = db.prepare(`
            INSERT INTO treasury_transactions (account_id, type, amount, date, description, related_entity_type, related_entity_id, user, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const row of oldRows) {
            let accId = 1;
            if (row.payment_method && (row.payment_method.includes('بنك') || row.payment_method.includes('CIB'))) accId = 2;
            else if (row.payment_method && (row.payment_method.includes('محفظة') || row.payment_method.includes('فودافون'))) accId = 5;
            
            const newType = row.type === 'receipt' ? 'IN' : 'OUT';
            insertTT.run(
                accId,
                newType,
                row.amount,
                row.transaction_date || row.created_at,
                row.description,
                row.party_type,
                row.party_id,
                row.created_by || 'System',
                row.created_at
            );
        }
        db.exec('DROP TABLE treasury_transactions_old;');
    } else if (ttCols.length === 0) {
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
            );
        `);
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            default_price REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS customer_item_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            unit TEXT NOT NULL,
            price REAL NOT NULL,
            UNIQUE(customer_id, item_name, unit),
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS worker_leaves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id INTEGER NOT NULL,
            leave_type TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            days REAL NOT NULL,
            reason TEXT,
            notes TEXT,
            status TEXT DEFAULT 'approved',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            plate_number TEXT,
            driver TEXT,
            status TEXT DEFAULT 'active',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT DEFAULT 'مستخدم النظام',
            action TEXT NOT NULL,
            module TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            description TEXT,
            old_values TEXT,
            new_values TEXT,
            status TEXT DEFAULT 'SUCCESS',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Seed default settings if table empty
    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM system_settings').get().count;
    if (settingsCount === 0) {
        const insertS = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
        insertS.run('company_name', 'الحندقوتي جروب');
        insertS.run('company_tagline', 'للصناعة والتجارة - مقاولات وتوريدات مواد البناء');
        insertS.run('company_phone1', '01099090919');
        insertS.run('company_phone1_label', 'الإدارة والحسابات');
        insertS.run('company_phone2', '01050990915');
        insertS.run('company_phone2_label', 'المحاسب عبد الرزاق');
        insertS.run('company_address', 'مصر - التجمع الخامس');
        insertS.run('company_tax_number', '');
        insertS.run('company_logo', '/logo.jpg');
        insertS.run('invoice_number_format', 'INV-{ID}');
        insertS.run('invoice_default_title', 'فاتورة مبيعات');
        insertS.run('invoice_show_logo', 'true');
        insertS.run('invoice_print_format', 'A4');
        insertS.run('system_currency', 'ج.م');
        insertS.run('system_date_format', 'YYYY-MM-DD');
        insertS.run('system_language', 'ar');
        insertS.run('system_direction', 'rtl');
    }

    const hasAdjPass = db.prepare("SELECT COUNT(*) as count FROM system_settings WHERE key = 'inventory_adjustment_password'").get().count;
    if (hasAdjPass === 0) {
        db.prepare("INSERT INTO system_settings (key, value) VALUES ('inventory_adjustment_password', '2345')").run();
    }

    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (usersCount === 0) {
        db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)').run(
            'المدير العام (الحندقوتي)',
            'admin',
            '123456',
            'مدير النظام'
        );
    }

    const alCols = db.prepare("PRAGMA table_info(audit_logs)").all().map(c => c.name);
    if (alCols.length > 0 && !alCols.includes('user_name')) {
        db.exec(`
            ALTER TABLE audit_logs RENAME TO audit_logs_old;

            CREATE TABLE audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT DEFAULT 'مستخدم النظام',
                action TEXT NOT NULL,
                module TEXT NOT NULL,
                entity_type TEXT,
                entity_id TEXT,
                description TEXT,
                old_values TEXT,
                new_values TEXT,
                status TEXT DEFAULT 'SUCCESS',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        try {
            const oldRows = db.prepare('SELECT * FROM audit_logs_old').all();
            const insertStmt = db.prepare(`
                INSERT INTO audit_logs (id, user_name, action, module, entity_type, entity_id, description, old_values, new_values, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const row of oldRows) {
                insertStmt.run(
                    row.id,
                    row.user_name || row.user || 'مستخدم النظام',
                    row.action || row.action_code || 'ACTION',
                    row.module || 'النظام',
                    row.entity_type || null,
                    row.entity_id || row.target_id || null,
                    row.description || '',
                    row.old_values || row.old_data || null,
                    row.new_values || row.new_data || null,
                    row.created_at || row.timestamp || new Date().toISOString()
                );
            }
        } catch(err) {
            console.error('Error migrating old audit_logs rows:', err);
        }

        db.exec('DROP TABLE audit_logs_old;');
    } else if (alCols.length === 0) {
        db.exec(`
            CREATE TABLE audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT DEFAULT 'مستخدم النظام',
                action TEXT NOT NULL,
                module TEXT NOT NULL,
                entity_type TEXT,
                entity_id TEXT,
                description TEXT,
                old_values TEXT,
                new_values TEXT,
                status TEXT DEFAULT 'SUCCESS',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    const addColIfMissing = (table, col, def) => {
        try {
            const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
            if (!tableExists) return;
            const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
            if (!cols.includes(col)) {
                db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def};`);
            }
        } catch (e) {
            console.error(`Error adding col ${col} to ${table}:`, e);
        }
    };

    addColIfMissing('suppliers', 'total_nawlon', 'REAL DEFAULT 0');
    addColIfMissing('suppliers', 'collected_nawlon', 'REAL DEFAULT 0');
    addColIfMissing('suppliers', 'default_credit_deadline', 'INTEGER DEFAULT 3');
    addColIfMissing('suppliers', 'status', "TEXT DEFAULT 'active'");
    addColIfMissing('suppliers', 'factory_id', 'INTEGER');

    addColIfMissing('purchases', 'credit_deadline', 'INTEGER DEFAULT 0');
    addColIfMissing('purchases', 'due_date', 'DATETIME');
    addColIfMissing('purchases', 'status', "TEXT DEFAULT 'completed'");

    addColIfMissing('transport_trips', 'customer_id', 'INTEGER');
    addColIfMissing('transport_trips', 'transaction_type', "TEXT DEFAULT 'purchase'");
    addColIfMissing('transport_trips', 'notes', 'TEXT');
    addColIfMissing('transport_trips', 'vehicle_id', 'INTEGER');
    addColIfMissing('transport_trips', 'revenues', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'kilowatts', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'expense_statement', 'TEXT');
    addColIfMissing('transport_trips', 'purchase_id', 'INTEGER');
    addColIfMissing('transport_trips', 'vehicle', 'TEXT');
    addColIfMissing('transport_trips', 'plate_number', 'TEXT');
    addColIfMissing('transport_trips', 'driver_phone', 'TEXT');
    addColIfMissing('transport_trips', 'quantity', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'from_location', 'TEXT');
    addColIfMissing('transport_trips', 'to_location', 'TEXT');
    addColIfMissing('transport_trips', 'calc_method', "TEXT DEFAULT 'fixed'");
    addColIfMissing('transport_trips', 'nawlon_cost', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'advance_amount', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'commission', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'expenses', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'fuel', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'maintenance', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'gratuity_food', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'allowance_balance', 'REAL DEFAULT 0');
    addColIfMissing('transport_trips', 'paid_by', "TEXT DEFAULT 'الشركة'");
    addColIfMissing('transport_trips', 'status', "TEXT DEFAULT 'completed'");

    addColIfMissing('treasury_transactions', 'reference_type', 'TEXT');
    addColIfMissing('treasury_transactions', 'reference_id', 'INTEGER');

    addColIfMissing('barsal_records', 'villa', 'TEXT');
    addColIfMissing('barsal_records', 'barsal', 'TEXT');
    addColIfMissing('barsal_records', 'type', 'TEXT');
    addColIfMissing('barsal_records', 'unit_price', 'REAL DEFAULT 0');
    addColIfMissing('barsal_records', 'total_amount', 'REAL DEFAULT 0');
    addColIfMissing('barsal_records', 'paid_amount', 'REAL DEFAULT 0');
    addColIfMissing('barsal_records', 'net_amount', 'REAL DEFAULT 0');
    addColIfMissing('barsal_records', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    addColIfMissing('worker_attendance', 'date', 'DATE');
    addColIfMissing('worker_attendance', 'end_time', 'TEXT');
    addColIfMissing('worker_attendance', 'attendance_date', 'DATE');

    addColIfMissing('credit_sale_items', 'item_type', "TEXT DEFAULT 'product'");
    addColIfMissing('credit_sale_items', 'service_id', 'INTEGER');

    addColIfMissing('inventory_items', 'conversion_operator', "TEXT DEFAULT '/'");

    addColIfMissing('worker_attendance', 'start_time', 'TEXT');
    addColIfMissing('worker_attendance', 'total_hours', 'REAL');

    // Financial Periods table
    db.exec(`
        CREATE TABLE IF NOT EXISTS financial_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE,
            status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME
        );
    `);

    const periodCount = db.prepare('SELECT COUNT(*) as count FROM financial_periods').get().count;
    if (periodCount === 0) {
        db.prepare(`
            INSERT INTO financial_periods (id, name, start_date, status, notes)
            VALUES (1, 'الفترة الأولى - بداية التشغيل 2026', '2026-09-01', 'OPEN', 'الفترة المالية الافتراضية الأولى للنظام')
        `).run();
    }

    addColIfMissing('credit_sales', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('credit_sales', 'zara_amount', 'REAL DEFAULT 0');
    addColIfMissing('purchases', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('expenses', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('other_expenses', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('other_expenses', 'account_id', 'INTEGER DEFAULT 1');
    addColIfMissing('treasury_transactions', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('inventory_movements', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('barsal_trips', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('transport_trips', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('customer_payments', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('customer_payments', 'account_id', 'INTEGER REFERENCES financial_accounts(id)');
    addColIfMissing('customer_adjustments', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('customer_adjustments', 'credit_sale_id', 'INTEGER');
    addColIfMissing('customer_adjustments', 'reference_number', 'TEXT');
    addColIfMissing('customer_adjustments', 'recorded_by', 'TEXT');
    addColIfMissing('supplier_balance_transactions', 'period_id', 'INTEGER DEFAULT 1');
    addColIfMissing('supplier_balance_transactions', 'account_id', 'INTEGER REFERENCES financial_accounts(id)');

    db.exec(`
        CREATE TABLE IF NOT EXISTS opening_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL CHECK(entity_type IN ('customer', 'supplier', 'factory', 'worker', 'treasury', 'financial_account')),
            entity_id INTEGER NOT NULL,
            balance_type TEXT NOT NULL CHECK(balance_type IN ('debit', 'credit')),
            amount REAL NOT NULL,
            effective_date DATE NOT NULL,
            notes TEXT,
            reference TEXT,
            period_id INTEGER DEFAULT 1,
            created_by TEXT DEFAULT 'مستخدم النظام',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(entity_type, entity_id)
        );
    `);

    const obSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='opening_balances'").get()?.sql || '';
    if (obSql && !obSql.includes('treasury')) {
        try {
            db.exec(`
                ALTER TABLE opening_balances RENAME TO opening_balances_old;
                CREATE TABLE opening_balances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity_type TEXT NOT NULL CHECK(entity_type IN ('customer', 'supplier', 'factory', 'worker', 'treasury', 'financial_account')),
                    entity_id INTEGER NOT NULL,
                    balance_type TEXT NOT NULL CHECK(balance_type IN ('debit', 'credit')),
                    amount REAL NOT NULL,
                    effective_date DATE NOT NULL,
                    notes TEXT,
                    reference TEXT,
                    period_id INTEGER DEFAULT 1,
                    created_by TEXT DEFAULT 'مستخدم النظام',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(entity_type, entity_id)
                );
                INSERT INTO opening_balances SELECT * FROM opening_balances_old;
                DROP TABLE opening_balances_old;
            `);
        } catch (e) {
            console.error('Error migrating opening_balances CHECK constraint:', e);
        }
    }

    // Ensure customer_account_transactions allows OPENING_BALANCE
    const catSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='customer_account_transactions'").get()?.sql || '';
    if (catSql && !catSql.includes('OPENING_BALANCE')) {
        try {
            db.exec(`
                ALTER TABLE customer_account_transactions RENAME TO customer_account_transactions_old;
                CREATE TABLE customer_account_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    credit_sale_id INTEGER,
                    payment_id INTEGER,
                    adjustment_id INTEGER,
                    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('SALE', 'PAYMENT', 'ZARA', 'OPENING_BALANCE')),
                    amount REAL NOT NULL,
                    balance_after REAL NOT NULL,
                    transaction_date DATETIME NOT NULL,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY (credit_sale_id) REFERENCES credit_sales(id) ON DELETE SET NULL,
                    FOREIGN KEY (payment_id) REFERENCES customer_payments(id) ON DELETE SET NULL
                );
                INSERT INTO customer_account_transactions SELECT * FROM customer_account_transactions_old;
                DROP TABLE customer_account_transactions_old;
            `);
        } catch (e) {
            console.error('Error migrating customer_account_transactions CHECK constraint:', e);
        }
    }

    // Ensure supplier_balance_transactions allows opening_balance
    const sbtSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='supplier_balance_transactions'").get()?.sql || '';
    if (sbtSql && !sbtSql.includes('opening_balance')) {
        try {
            db.exec(`
                ALTER TABLE supplier_balance_transactions RENAME TO supplier_balance_transactions_old;
                CREATE TABLE supplier_balance_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id INTEGER NOT NULL,
                    amount REAL NOT NULL,
                    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('purchase', 'deposit', 'opening_balance')),
                    reference_number TEXT,
                    description TEXT,
                    period_id INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
                );
                INSERT INTO supplier_balance_transactions SELECT * FROM supplier_balance_transactions_old;
                DROP TABLE supplier_balance_transactions_old;
            `);
        } catch (e) {
            console.error('Error migrating supplier_balance_transactions CHECK constraint:', e);
        }
    }

    // Ensure suppliers table allows 'مورد' and 'مصنع'
    const supSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='suppliers'").get()?.sql || '';
    if (supSql && supSql.includes("CHECK(type IN ('توريد مواد', 'مصنع'))")) {
        try {
            db.pragma('foreign_keys = OFF');
            db.pragma('legacy_alter_table = ON');
            db.transaction(() => {
                db.exec(`
                    ALTER TABLE suppliers RENAME TO suppliers_old;

                    CREATE TABLE suppliers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        type TEXT NOT NULL CHECK(type IN ('مورد', 'مصنع', 'توريد مواد', 'مورد عام')),
                        contact_person TEXT,
                        phone TEXT,
                        alt_phone TEXT,
                        address TEXT,
                        governorate TEXT,
                        balance REAL DEFAULT 0,
                        default_credit_deadline INTEGER DEFAULT 3,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        total_nawlon REAL DEFAULT 0,
                        collected_nawlon REAL DEFAULT 0,
                        factory_id INTEGER,
                        status TEXT DEFAULT 'active'
                    );

                    INSERT INTO suppliers (
                        id, name, type, contact_person, phone, alt_phone, address, governorate,
                        balance, default_credit_deadline, notes, created_at, total_nawlon, collected_nawlon
                    )
                    SELECT 
                        id, name, 
                        CASE 
                            WHEN type = 'توريد مواد' THEN 'مورد'
                            ELSE type 
                        END,
                        contact_person, phone, alt_phone, address, governorate,
                        balance, default_credit_deadline, notes, created_at, 
                        COALESCE(total_nawlon, 0), COALESCE(collected_nawlon, 0)
                    FROM suppliers_old;

                    DROP TABLE suppliers_old;
                `);
            })();
            db.pragma('legacy_alter_table = OFF');
            db.pragma('foreign_keys = ON');
            console.log('Successfully migrated suppliers table constraint to allow مورد and مصنع');
        } catch (e) {
            console.error('Error migrating suppliers CHECK constraint:', e);
        }
    }

    // Auto-heal any dangling references to suppliers_old in foreign keys
    try {
        const dangling = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%suppliers_old%'").all();
        if (dangling.length > 0) {
            db.pragma('foreign_keys = OFF');
            db.pragma('legacy_alter_table = ON');
            for (const d of dangling) {
                const fixedSql = d.sql.replace(/"suppliers_old"/g, 'suppliers').replace(/suppliers_old/g, 'suppliers');
                db.transaction(() => {
                    db.exec(`ALTER TABLE "${d.name}" RENAME TO "${d.name}_old_fix"`);
                    db.exec(fixedSql);
                    db.exec(`INSERT INTO "${d.name}" SELECT * FROM "${d.name}_old_fix"`);
                    db.exec(`DROP TABLE "${d.name}_old_fix"`);
                })();
            }
            db.pragma('legacy_alter_table = OFF');
            db.pragma('foreign_keys = ON');
        }
    } catch (e) {
        console.error('Error healing dangling suppliers_old foreign keys:', e);
    }

    try {
        db.exec("UPDATE treasury_transactions SET description = 'رصيد الدفتر' WHERE related_entity_type = 'OPENING_BALANCE' OR description LIKE 'رصيد افتتاحي%'");
    } catch (e) {
        console.error('Error updating treasury opening balance description:', e);
    }

    try {
        db.exec(`
            UPDATE inventory_items 
            SET unit = 'طن', secondary_unit = 'شكارة', conversion_factor = 20, conversion_operator = '/' 
            WHERE (name LIKE '%أسمنت%' OR name LIKE '%اسمنت%' OR name LIKE '%سمنت%');

            UPDATE inventory_items 
            SET unit = 'نقلة', secondary_unit = 'متر ونص', conversion_factor = 1.5, conversion_operator = '/' 
            WHERE (name LIKE '%رمل%' OR name LIKE '%رمال%' OR name LIKE '%رملة%');
        `);
    } catch (e) {
        console.error('Error setting default units for cement/sand:', e);
    }

    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS partners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                share_percentage REAL NOT NULL,
                capital_contribution REAL DEFAULT 0,
                start_date DATE,
                phone TEXT,
                notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const ptCols = db.prepare("PRAGMA table_info(partner_transactions)").all().map(c => c.name);
        if (ptCols.length === 0) {
            db.exec(`
                CREATE TABLE IF NOT EXISTS partner_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    partner_id INTEGER NOT NULL,
                    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('withdrawal', 'payment', 'capital_contribution', 'profit_distribution', 'withdrawal_return')),
                    amount REAL NOT NULL,
                    transaction_date DATE NOT NULL,
                    payment_method TEXT DEFAULT 'نقدي (كاش)',
                    account_id INTEGER,
                    treasury_tx_id INTEGER,
                    description TEXT,
                    reference TEXT,
                    notes TEXT,
                    parent_transaction_id INTEGER,
                    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
                    cancel_reason TEXT,
                    cancelled_at DATETIME,
                    cancelled_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT,
                    FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL,
                    FOREIGN KEY (treasury_tx_id) REFERENCES treasury_transactions(id) ON DELETE SET NULL,
                    FOREIGN KEY (parent_transaction_id) REFERENCES partner_transactions(id) ON DELETE RESTRICT
                );
            `);
        } else if (!ptCols.includes('parent_transaction_id')) {
            db.transaction(() => {
                db.exec(`
                    ALTER TABLE partner_transactions RENAME TO partner_transactions_old;

                    CREATE TABLE partner_transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        partner_id INTEGER NOT NULL,
                        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('withdrawal', 'payment', 'capital_contribution', 'profit_distribution', 'withdrawal_return')),
                        amount REAL NOT NULL,
                        transaction_date DATE NOT NULL,
                        payment_method TEXT DEFAULT 'نقدي (كاش)',
                        account_id INTEGER,
                        treasury_tx_id INTEGER,
                        description TEXT,
                        reference TEXT,
                        notes TEXT,
                        parent_transaction_id INTEGER,
                        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
                        cancel_reason TEXT,
                        cancelled_at DATETIME,
                        cancelled_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT,
                        FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL,
                        FOREIGN KEY (treasury_tx_id) REFERENCES treasury_transactions(id) ON DELETE SET NULL,
                        FOREIGN KEY (parent_transaction_id) REFERENCES partner_transactions(id) ON DELETE RESTRICT
                    );

                    INSERT INTO partner_transactions (
                        id, partner_id, transaction_type, amount, transaction_date, payment_method,
                        account_id, treasury_tx_id, description, reference, notes, parent_transaction_id,
                        status, cancel_reason, cancelled_at, cancelled_by, created_at, updated_at
                    )
                    SELECT 
                        id, partner_id, transaction_type, amount, transaction_date, payment_method,
                        account_id, treasury_tx_id, description, reference, notes, NULL,
                        'active', NULL, NULL, NULL, created_at, updated_at
                    FROM partner_transactions_old;

                    DROP TABLE partner_transactions_old;
                `);
            })();
        }
    } catch (e) {
        console.error('Error migrating partners tables:', e);
    }

    try {
        const purchCols = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name);
        if (purchCols.length > 0) {
            if (!purchCols.includes('payment_type')) {
                db.exec("ALTER TABLE purchases ADD COLUMN payment_type TEXT DEFAULT 'credit'");
            }
            if (!purchCols.includes('account_id')) {
                db.exec("ALTER TABLE purchases ADD COLUMN account_id INTEGER REFERENCES financial_accounts(id)");
            }
            if (!purchCols.includes('payment_method')) {
                db.exec("ALTER TABLE purchases ADD COLUMN payment_method TEXT DEFAULT 'نقدي'");
            }
        }
    } catch (e) {
        console.error('Error migrating purchases payment columns:', e);
    }
}

function applyIndexes(db) {
    try {
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_sales_cust_date ON credit_sales(customer_id, sale_date);
            CREATE INDEX IF NOT EXISTS idx_sales_status ON credit_sales(status);
            CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON credit_sale_items(credit_sale_id);
            CREATE INDEX IF NOT EXISTS idx_purchases_supp_date ON purchases(supplier_id, purchase_date);
            CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
            CREATE INDEX IF NOT EXISTS idx_inv_mov_item_date ON inventory_movements(item_id, movement_date);
            CREATE INDEX IF NOT EXISTS idx_inv_mov_ref ON inventory_movements(reference_type, reference_id);
            CREATE INDEX IF NOT EXISTS idx_treasury_acc_date ON treasury_transactions(account_id, date);
            CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_cust_payments_sale ON customer_payments(credit_sale_id);
            CREATE INDEX IF NOT EXISTS idx_supp_trans_supp ON supplier_balance_transactions(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_supp_trans_acc ON supplier_balance_transactions(account_id);
            CREATE INDEX IF NOT EXISTS idx_opening_bal_entity ON opening_balances(entity_type, entity_id);
            CREATE INDEX IF NOT EXISTS idx_partner_transactions_partner ON partner_transactions(partner_id, transaction_date);
            CREATE INDEX IF NOT EXISTS idx_partner_transactions_treasury ON partner_transactions(treasury_tx_id);
            CREATE INDEX IF NOT EXISTS idx_partner_transactions_parent ON partner_transactions(parent_transaction_id);
            CREATE INDEX IF NOT EXISTS idx_partner_transactions_status ON partner_transactions(status);
        `);
    } catch(err) {
        console.error('Error applying performance indexes:', err.message);
    }
}

let activeDbPath = process.env.DB_PATH || path.resolve(__dirname, 'database.sqlite');
let currentDb = null;

function initDb(targetPath = activeDbPath) {
    if (currentDb) {
        try { currentDb.close(); } catch(e){}
    }
    activeDbPath = targetPath;
    const db = new Database(activeDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        if (schema.trim()) db.exec(schema);
    }
    runMigrations(db);
    applyIndexes(db);
    try {
        const purchaseAllocationService = require('../services/purchaseAllocationService');
        purchaseAllocationService.initSchema(db);
        purchaseAllocationService.backfillAllocations(db);
    } catch (err) {
        console.error('Error initializing purchase allocations:', err.message);
    }
    console.log(`Database connected successfully to: ${activeDbPath}`);
    currentDb = db;
    return db;
}

currentDb = initDb();

const proxyDb = new Proxy({}, {
    get(target, prop, receiver) {
        if (prop === 'closeConnection') {
            return () => {
                if (currentDb) {
                    try { currentDb.pragma('wal_checkpoint(TRUNCATE)'); } catch(e){}
                    try { currentDb.close(); } catch(e){}
                    currentDb = null;
                }
            };
        }
        if (prop === 'initDb') {
            return (targetPath) => initDb(targetPath || activeDbPath);
        }
        if (prop === 'switchDatabase') {
            return (newPath) => {
                return initDb(newPath);
            };
        }
        if (prop === 'getActiveDatabasePath') {
            return () => activeDbPath;
        }
        if (prop === 'isTestDatabase') {
            return () => activeDbPath.includes('test') || activeDbPath.includes('TEST');
        }
        if (prop === 'applyIndexes') {
            return () => applyIndexes(currentDb);
        }
        if (prop === 'getRawInstance') {
            return () => currentDb;
        }

        const value = currentDb[prop];
        if (typeof value === 'function') {
            return value.bind(currentDb);
        }
        return value;
    }
});

module.exports = proxyDb;

