const db = require('../db/index');
const auditLogger = require('./auditLogger');
const fs = require('fs');
const path = require('path');

// Helper to get all settings as an object
function getAllSettingsMap() {
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settingsMap = {};
    rows.forEach(r => {
        if (r.key === 'inventory_adjustment_password') {
            settingsMap[r.key] = '••••••••';
        } else {
            settingsMap[r.key] = r.value;
        }
    });
    return settingsMap;
}

exports.getSettings = (req, res) => {
    try {
        const settings = getAllSettingsMap();
        res.json(settings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الإعدادات' });
    }
};

exports.updateSettings = (req, res) => {
    try {
        const newSettings = req.body;
        if (!newSettings || typeof newSettings !== 'object') {
            return res.status(400).json({ error: 'بيانات الإعدادات غير صحيحة' });
        }

        const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        
        const transaction = db.transaction(() => {
            for (const [key, value] of Object.entries(newSettings)) {
                if (key === 'inventory_adjustment_password') continue;
                if (value !== undefined && value !== null) {
                    upsert.run(key, String(value));
                }
            }
        });

        transaction();

        auditLogger.logAction('مستخدم النظام', 'UPDATE', 'الإعدادات', 'SETTINGS', 'SYSTEM', 'تحديث إعدادات النظام', null, newSettings);

        const updated = getAllSettingsMap();
        res.json({ message: 'تم حفظ الإعدادات بنجاح', settings: updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ الإعدادات' });
    }
};

exports.updateCompanyInfo = (req, res) => {
    try {
        const { company_name, company_tagline, company_phone1, company_phone1_label, company_phone2, company_phone2_label, company_address, company_tax_number, company_logo } = req.body;

        const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        
        const transaction = db.transaction(() => {
            if (company_name !== undefined) upsert.run('company_name', company_name);
            if (company_tagline !== undefined) upsert.run('company_tagline', company_tagline);
            if (company_phone1 !== undefined) upsert.run('company_phone1', company_phone1);
            if (company_phone1_label !== undefined) upsert.run('company_phone1_label', company_phone1_label);
            if (company_phone2 !== undefined) upsert.run('company_phone2', company_phone2);
            if (company_phone2_label !== undefined) upsert.run('company_phone2_label', company_phone2_label);
            if (company_address !== undefined) upsert.run('company_address', company_address);
            if (company_tax_number !== undefined) upsert.run('company_tax_number', company_tax_number);
            if (company_logo !== undefined) upsert.run('company_logo', company_logo);
        });

        transaction();

        auditLogger.logAction('مستخدم النظام', 'UPDATE', 'الإعدادات', 'COMPANY', 'INFO', 'تحديث بيانات الشركة', null, req.body);

        const updated = getAllSettingsMap();
        res.json({ message: 'تم حفظ بيانات الشركة بنجاح', settings: updated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ بيانات الشركة' });
    }
};

exports.getUserInfo = (req, res) => {
    try {
        const user = db.prepare('SELECT id, name, username, role, created_at FROM users LIMIT 1').get();
        if (!user) {
            return res.json({ name: 'المدير العام', username: 'admin', role: 'مدير النظام' });
        }
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات الحساب' });
    }
};

exports.updateUserInfo = (req, res) => {
    try {
        const { name, username } = req.body;
        const user = db.prepare('SELECT * FROM users LIMIT 1').get();
        if (user) {
            db.prepare('UPDATE users SET name = ?, username = ? WHERE id = ?').run(name || user.name, username || user.username, user.id);
        } else {
            db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)').run(name || 'المدير العام', username || 'admin', '', 'مدير النظام');
        }
        const updatedUser = db.prepare('SELECT id, name, username, role, created_at FROM users LIMIT 1').get();
        res.json({ message: 'تم تحديث بيانات الحساب بنجاح', user: updatedUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات الحساب' });
    }
};

exports.changePassword = (req, res) => {
    try {
        const { new_password } = req.body;
        if (!new_password || new_password.trim().length < 3) {
            return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الجديدة (3 أحرف أو أرقام على الأقل)' });
        }

        const user = db.prepare('SELECT * FROM users LIMIT 1').get();
        if (user) {
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(new_password.trim(), user.id);
        } else {
            db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)').run('المدير العام', 'admin', new_password.trim(), 'مدير النظام');
        }

        auditLogger.logAction('مستخدم النظام', 'UPDATE', 'الإعدادات', 'USER', 'PASSWORD', 'تحديث كلمة المرور', null, null);

        res.json({ message: 'تم تعيين وحفظ كلمة المرور الجديدة بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ كلمة المرور' });
    }
};

const backupService = require('../services/backupService');

exports.getBackupInfo = (req, res) => {
    try {
        const info = backupService.getLastBackupInfo();
        res.json(info);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب معلومات النسخة الاحتياطية' });
    }
};

exports.downloadBackup = (req, res) => {
    try {
        const backupResult = backupService.createBackup('تحميل نسخة احتياطية يدوية من شاشة الإعدادات');
        
        res.setHeader('Content-Type', 'application/x-sqlite3');
        res.setHeader('Content-Disposition', `attachment; filename="${backupResult.fileName}"`);
        
        res.download(backupResult.path, backupResult.fileName, (err) => {
            if (err && !res.headersSent) {
                console.error('Download error:', err);
                res.status(500).json({ error: 'حدث خطأ أثناء تحميل ملف النسخة الاحتياطية' });
            }
        });
    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء النسخة الاحتياطية' });
    }
};

exports.downloadReadableBackup = (req, res) => {
    try {
        const getTable = (tableName) => {
            try {
                return db.prepare(`SELECT * FROM ${tableName}`).all();
            } catch (err) {
                return [];
            }
        };

        const data = {
            export_date: new Date().toISOString(),
            system_version: '1.0.0',
            settings: getTable('system_settings'),
            customers: getTable('customers'),
            suppliers: getTable('suppliers'),
            inventory_items: getTable('inventory_items'),
            credit_sales: getTable('credit_sales'),
            credit_sale_items: getTable('credit_sale_items'),
            purchases: getTable('purchases'),
            purchase_items: getTable('purchase_items'),
            treasury_transactions: getTable('treasury_transactions'),
            expenses: getTable('expenses'),
            other_expenses: getTable('other_expenses'),
            workers: getTable('workers'),
            vehicles: getTable('vehicles')
        };

        const jsonStr = JSON.stringify(data, null, 2);
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `backup_data_readable_${dateStr}.json`;

        auditLogger.logAction('مستخدم النظام', 'CREATE', 'الإعدادات', 'BACKUP', 'READABLE_DOWNLOAD', 'تحميل نسخة بيانات نصية قابلة للقراءة', null, null);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(jsonStr);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'حدث خطأ أثناء استخراج البيانات للقراءة' });
    }
};

exports.restoreBackup = (req, res) => {
    let tempFilePath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'يرجى اختيار ملف النسخة الاحتياطية (.db)' });
        }

        const tempDir = path.resolve(__dirname, '../../backups/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const fileName = req.file.originalname || `uploaded_${Date.now()}.db`;
        tempFilePath = path.join(tempDir, `temp_restore_${Date.now()}_${fileName}`);

        const fileBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        if (!fileBuffer) {
            return res.status(400).json({ error: 'تعذر قراءة محتوى الملف المرفوع' });
        }

        fs.writeFileSync(tempFilePath, fileBuffer);

        const result = backupService.restoreBackup(tempFilePath, 'المدير العام');
        
        try { fs.unlinkSync(tempFilePath); } catch(e){}

        res.json({
            message: result.message || 'تم استرجاع قاعدة البيانات بنجاح',
            safetyBackup: result.safetyBackup,
            summary: result.summary
        });
    } catch (error) {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch(e){}
        }
        console.error('Error restoring backup:', error);
        res.status(400).json({ error: error.message || 'ملف النسخة الاحتياطية غير صالح أو تالف، ولم يتم تغيير البيانات الحالية.' });
    }
};

exports.changeInventoryAdjustmentPassword = (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password) {
            return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية' });
        }
        if (!new_password || new_password.trim().length === 0) {
            return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الجديدة' });
        }
        if (new_password !== confirm_password) {
            return res.status(400).json({ error: 'كلمتا المرور الجديدة وتأكيدها غير متطابقتين' });
        }

        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'inventory_adjustment_password'").get();
        const storedPassword = (row && row.value) ? row.value : '2345';

        if (current_password.toString().trim() !== storedPassword.trim()) {
            return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
        }

        db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('inventory_adjustment_password', ?, CURRENT_TIMESTAMP)")
          .run(new_password.trim());

        auditLogger.logAction('مستخدم النظام', 'UPDATE', 'الإعدادات', 'INVENTORY', 'PASSWORD', 'تحديث كلمة مرور تسوية المخزن', null, null);

        res.json({ message: 'تم تغيير كلمة مرور تسوية المخزن بنجاح' });
    } catch (error) {
        console.error('Error changing inventory adjustment password:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تغيير كلمة مرور تسوية المخزن' });
    }
};
