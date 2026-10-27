-- Full Application Database Schema for Alhaj Refaat System

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    alt_phone TEXT,
    address TEXT,
    national_id TEXT,
    notes TEXT,
    default_credit_deadline INTEGER DEFAULT 3,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    invoice_number TEXT,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    remaining_amount REAL DEFAULT 0,
    purchase_date DATETIME NOT NULL,
    credit_deadline INTEGER DEFAULT 0,
    due_date DATETIME,
    location TEXT,
    notes TEXT,
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT,
    base_quantity REAL,
    base_unit TEXT,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS supplier_balance_transactions (
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

CREATE TABLE IF NOT EXISTS credit_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    invoice_number TEXT,
    original_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    zara_amount REAL DEFAULT 0,
    remaining_amount REAL NOT NULL,
    sale_date DATETIME NOT NULL,
    credit_deadline INTEGER DEFAULT 0,
    due_date DATETIME NOT NULL,
    sale_type TEXT DEFAULT 'credit',
    status TEXT DEFAULT 'CONFIRMED',
    notes TEXT,
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS credit_sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credit_sale_id INTEGER NOT NULL,
    item_type TEXT DEFAULT 'product',
    service_id INTEGER,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (credit_sale_id) REFERENCES credit_sales(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    credit_sale_id INTEGER,
    amount REAL NOT NULL,
    payment_date DATETIME NOT NULL,
    payment_method TEXT DEFAULT 'نقدًا',
    reference_number TEXT,
    notes TEXT,
    recorded_by TEXT,
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (credit_sale_id) REFERENCES credit_sales(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_account_transactions (
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

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_type TEXT NOT NULL,
    vehicle TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date DATETIME NOT NULL,
    description TEXT,
    document_number TEXT,
    notes TEXT,
    maintenance_type TEXT,
    spare_parts_cost REAL DEFAULT 0,
    labor_cost REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    job_title TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    monthly_salary REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worker_withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    withdrawal_type TEXT NOT NULL,
    withdrawal_date DATETIME NOT NULL,
    description TEXT,
    document_number TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS other_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_name TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date DATETIME NOT NULL,
    description TEXT,
    document_number TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    unit TEXT,
    secondary_unit TEXT,
    conversion_factor REAL,
    conversion_operator TEXT DEFAULT '/',
    min_stock REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT,
    original_quantity REAL,
    original_unit TEXT,
    reference_type TEXT,
    reference_id INTEGER,
    supplier_id INTEGER,
    customer_id INTEGER,
    movement_date DATETIME NOT NULL,
    notes TEXT,
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS financial_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('CASH', 'BANK', 'EWALLET')),
    balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treasury_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'TRANSFER')),
    amount REAL NOT NULL,
    date DATETIME NOT NULL,
    description TEXT,
    related_entity_type TEXT,
    related_entity_id INTEGER,
    user TEXT DEFAULT 'System',
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES financial_accounts(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT DEFAULT 'مستخدم النظام',
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    description TEXT,
    old_values TEXT,
    new_values TEXT,
    status TEXT DEFAULT 'SUCCESS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS transport_trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_date DATETIME NOT NULL,
    vehicle_id INTEGER,
    vehicle TEXT,
    plate_number TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    route TEXT,
    from_location TEXT,
    to_location TEXT,
    quantity REAL DEFAULT 0,
    calc_method TEXT DEFAULT 'fixed',
    nawlon_cost REAL DEFAULT 0,
    advance_amount REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    expenses REAL DEFAULT 0,
    fuel REAL DEFAULT 0,
    maintenance REAL DEFAULT 0,
    gratuity_food REAL DEFAULT 0,
    allowance_balance REAL DEFAULT 0,
    customer_id INTEGER,
    supplier_id INTEGER,
    purchase_id INTEGER,
    transaction_type TEXT DEFAULT 'purchase',
    freight_amount REAL DEFAULT 0,
    collected_amount REAL DEFAULT 0,
    paid_by TEXT DEFAULT 'الشركة',
    payment_status TEXT DEFAULT 'غير مدفوع',
    status TEXT DEFAULT 'completed',
    revenues REAL DEFAULT 0,
    kilowatts REAL DEFAULT 0,
    expense_statement TEXT,
    notes TEXT,
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS freight_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER,
    supplier_id INTEGER,
    amount REAL NOT NULL,
    payment_method TEXT,
    collection_date DATETIME,
    reference_number TEXT,
    notes TEXT,
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES transport_trips(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    credit_sale_id INTEGER,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    adjustment_date DATETIME NOT NULL,
    reason TEXT,
    reference_number TEXT,
    notes TEXT,
    recorded_by TEXT,
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (credit_sale_id) REFERENCES credit_sales(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS worker_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER NOT NULL,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL,
    start_time TEXT,
    total_hours REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS barsal_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date DATETIME NOT NULL,
    driver_name TEXT,
    vehicle_number TEXT,
    quantity REAL DEFAULT 0,
    notes TEXT,
    period_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
