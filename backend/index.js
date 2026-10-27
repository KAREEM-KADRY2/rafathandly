const express = require('express');
const cors = require('cors');
require('dotenv').config();

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const db = require('./src/db/index'); // Init database

const app = express();
app.use(cors());
app.use(express.json());

const auditLogger = require('./src/controllers/auditLogger');
app.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    // Avoid double logging if controller already logged
                    if (res.locals.auditLogged) return;
                    
                    const urlParts = req.originalUrl.split('?')[0].split('/');
                    let modRaw = urlParts[2] || 'system';
                    const moduleMap = {
                        'customers': 'العملاء',
                        'suppliers': 'الموردين',
                        'sales': 'المبيعات',
                        'credit-sales': 'المبيعات',
                        'purchases': 'المشتريات',
                        'expenses': 'المصروفات',
                        'workers': 'العمال',
                        'other-expenses': 'مصروفات أخرى',
                        'inventory': 'المخزن',
                        'transport-trips': 'تصفية العربيات',
                        'barsal': 'البرسل',
                        'treasury': 'الخزينة',
                        'services': 'الخدمات',
                        'partners': 'الشراكة'
                    };
                    let module = moduleMap[modRaw] || modRaw;

                    let bodyToSave = req.body ? { ...req.body } : {};
                    let partyName = bodyToSave.customer_name || bodyToSave.supplier_name || bodyToSave.worker_name || bodyToSave.party_name || bodyToSave.factory_name || bodyToSave.name || null;
                    let partyLabel = 'الطرف';

                    try {
                        if (modRaw === 'sales' || modRaw === 'credit-sales') {
                            partyLabel = 'العميل';
                            if (!partyName && bodyToSave.customer_id) {
                                const cust = db.prepare('SELECT name FROM customers WHERE id = ?').get(bodyToSave.customer_id);
                                if (cust) partyName = cust.name;
                            }
                            if (!partyName) {
                                let saleId = req.params.id || bodyToSave.credit_sale_id || urlParts[urlParts.indexOf('credit-sales') + 1] || urlParts[urlParts.indexOf('sales') + 1];
                                if (saleId && !isNaN(parseInt(saleId))) {
                                    const row = db.prepare('SELECT c.name as customer_name FROM credit_sales s JOIN customers c ON s.customer_id = c.id WHERE s.id = ?').get(parseInt(saleId));
                                    if (row) partyName = row.customer_name;
                                }
                            }
                            if (partyName) bodyToSave.customer_name = partyName;
                        } else if (modRaw === 'customers') {
                            partyLabel = 'العميل';
                            if (!partyName && (req.params.id || bodyToSave.customer_id)) {
                                const cid = bodyToSave.customer_id || req.params.id;
                                const cust = db.prepare('SELECT name FROM customers WHERE id = ?').get(cid);
                                if (cust) partyName = cust.name;
                            }
                            if (partyName) bodyToSave.customer_name = partyName;
                        } else if (modRaw === 'purchases' || modRaw === 'suppliers') {
                            partyLabel = 'المورد/المصنع';
                            if (!partyName && bodyToSave.supplier_id) {
                                const supp = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(bodyToSave.supplier_id);
                                if (supp) partyName = supp.name;
                            }
                            if (!partyName) {
                                let pid = req.params.id || bodyToSave.purchase_id || urlParts[urlParts.indexOf('purchases') + 1];
                                if (pid && !isNaN(parseInt(pid))) {
                                    const row = db.prepare('SELECT s.name as supplier_name FROM purchases p JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?').get(parseInt(pid));
                                    if (row) partyName = row.supplier_name;
                                }
                            }
                            if (partyName) bodyToSave.supplier_name = partyName;
                        } else if (modRaw === 'workers') {
                            partyLabel = 'العامل';
                            if (!partyName && (bodyToSave.worker_id || req.params.id)) {
                                const wid = bodyToSave.worker_id || req.params.id;
                                const w = db.prepare('SELECT name FROM workers WHERE id = ?').get(wid);
                                if (w) partyName = w.name;
                            }
                            if (partyName) bodyToSave.worker_name = partyName;
                        } else if (modRaw === 'treasury') {
                            partyLabel = 'الطرف';
                            if (!partyName && bodyToSave.party_name) partyName = bodyToSave.party_name;
                        } else if (modRaw === 'partners') {
                            partyLabel = 'الشريك';
                            if (!partyName && (bodyToSave.partner_id || req.params.id)) {
                                const pid = bodyToSave.partner_id || req.params.id;
                                const p = db.prepare('SELECT name FROM partners WHERE id = ?').get(pid);
                                if (p) partyName = p.name;
                            }
                            if (partyName) bodyToSave.partner_name = partyName;
                        }
                    } catch (errEnrich) {
                        console.error('Audit party enrichment error:', errEnrich);
                    }
                    
                    let actionCode = req.method === 'POST' ? 'CREATE' : (req.method === 'DELETE' ? 'DELETE' : 'UPDATE');
                    let actionName = req.method === 'POST' ? 'إضافة' : (req.method === 'DELETE' ? 'حذف/إلغاء' : 'تعديل');
                    let desc = `عملية ` + actionName + ` في ` + module;
                    
                    if (req.originalUrl.includes('payment') || req.originalUrl.includes('deposit')) {
                        desc = `عملية سداد/إيداع في ` + module;
                    } else if (req.originalUrl.includes('withdrawal')) {
                        desc = `عملية سحب/مصروف في ` + module;
                    } else if (req.originalUrl.includes('cancel')) {
                        desc = `عملية إلغاء في ` + module;
                    }

                    if (partyName) {
                        desc += ` لـ (${partyLabel}: ${partyName})`;
                    } else if (bodyToSave.name) {
                        desc += ` (${bodyToSave.name})`;
                    }

                    if (bodyToSave.amount) {
                        desc += ` بقيمة ` + bodyToSave.amount;
                    } else if (bodyToSave.invoice_number) {
                        desc += ` لفاتورة ` + bodyToSave.invoice_number;
                    }

                    auditLogger.logAction(
                        'مستخدم النظام',
                        actionCode,
                        module,
                        modRaw.toUpperCase(),
                        urlParts[urlParts.length - 1] !== modRaw ? urlParts[urlParts.length - 1] : '',
                        desc,
                        null,
                        bodyToSave
                    );
                } catch(e) {
                    console.error('Auto Audit Error:', e);
                }
            }
        });
    }
    next();
});

// Routes
const supplierRoutes = require('./src/routes/suppliers');
const purchaseRoutes = require('./src/routes/purchases');
const transportRoutes = require('./src/routes/transports');
const customerRoutes = require('./src/routes/customers');
const creditSaleRoutes = require('./src/routes/creditSales');
const expenseRoutes = require('./src/routes/expenses');
const workerRoutes = require('./src/routes/workers');
const otherExpenseRoutes = require('./src/routes/otherExpenses');
const reportsRoutes = require('./src/routes/reports');
const reportsCenterRoutes = require('./src/routes/reportsCenter');
const reportsV2Routes = require('./src/routes/reportsV2');
const inventoryRoutes = require('./src/routes/inventory');
const dashboardRoutes = require('./src/routes/dashboard');
const barsalRoutes = require('./src/routes/barsal');

app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/transport-trips', transportRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/credit-sales', creditSaleRoutes);
app.use('/api/sales', creditSaleRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/other-expenses', otherExpenseRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/reports-center', reportsCenterRoutes);
app.use('/api/reports-v2', reportsV2Routes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/barsal', barsalRoutes);
const servicesRoutes = require('./src/routes/services');
app.use('/api/services', servicesRoutes);

const treasuryRoutes = require('./src/routes/treasury');
app.use('/api/treasury', treasuryRoutes);

const partnerRoutes = require('./src/routes/partners');
app.use('/api/partners', partnerRoutes);
const auditRoutes = require('./src/routes/auditRoutes');
app.use('/api/audit-logs', auditRoutes);

const vehicleRoutes = require('./src/routes/vehicleRoutes');
app.use('/api/vehicles', vehicleRoutes);

const settingsRoutes = require('./src/routes/settingsRoutes');
app.use('/api/settings', settingsRoutes);

const periodRoutes = require('./src/routes/periods');
app.use('/api/periods', periodRoutes);

const openingBalanceRoutes = require('./src/routes/openingBalanceRoutes');
app.use('/api/opening-balances', openingBalanceRoutes);

const stressTestRoutes = require('./src/routes/stressTestRoutes');
app.use('/api/stress-test', stressTestRoutes);

const backupRoutes = require('./src/routes/backupRoutes');
const backupService = require('./src/services/backupService');
app.use('/api/backups', backupRoutes);
backupService.initScheduledBackups();



const fs = require('fs');
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'al_hajj_refaat', name: 'Al-Hajj Refaat System', timestamp: new Date().toISOString() });
});

app.post('/api/log-error', (req, res) => {
    fs.appendFileSync('frontend-error.log', JSON.stringify(req.body) + '\n');
    res.send('ok');
});

const path = require('path');
let frontendPath = path.join(__dirname, '../frontend/dist');
if (!fs.existsSync(frontendPath)) {
    frontendPath = path.join(__dirname, '../dist');
}
if (!fs.existsSync(frontendPath)) {
    frontendPath = path.join(__dirname, 'dist');
}
app.use(express.static(frontendPath));

app.get('*', (req, res, next) => {
    // If the request is for an asset (JS, CSS) that wasn't found (cached HTML requesting old chunk)
    if (req.path.startsWith('/assets/')) {
        const ext = req.path.split('.').pop();
        if (ext === 'js' || ext === 'css') {
            try {
                const assetsDir = path.join(frontendPath, 'assets');
                if (fs.existsSync(assetsDir)) {
                    const files = fs.readdirSync(assetsDir);
                    const matching = files
                        .filter(f => f.endsWith(`.${ext}`) && f.startsWith('index-'))
                        .map(f => ({ name: f, time: fs.statSync(path.join(assetsDir, f)).mtimeMs }))
                        .sort((a, b) => b.time - a.time);
                    if (matching.length > 0 && !req.path.includes(matching[0].name)) {
                        return res.redirect(`/assets/${matching[0].name}`);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }
        return res.status(404).send('Not found');
    }
    // Otherwise, return index.html for client-side routing with no-cache headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (process.env.OPEN_BROWSER === 'true') {
        try {
            const { exec } = require('child_process');
            exec('start http://127.0.0.1:5000');
        } catch (e) {
            console.error('Failed to open browser:', e);
        }
    }
});

module.exports = app;

