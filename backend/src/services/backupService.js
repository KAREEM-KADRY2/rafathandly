const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const db = require('../db');
const auditLogger = require('../controllers/auditLogger');

const BACKUP_DIR = path.resolve(__dirname, '../../backups');
const PRE_RESTORE_DIR = path.resolve(BACKUP_DIR, 'pre_restore');

function ensureDirectories() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    if (!fs.existsSync(PRE_RESTORE_DIR)) {
        fs.mkdirSync(PRE_RESTORE_DIR, { recursive: true });
    }
}

function formatDateForFilename(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

/**
 * Validate that a given file path is a valid, uncorrupted SQLite database
 * containing all essential Al-Hajj Refaat system tables.
 */
function validateBackupFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'الملف غير موجود على القرص' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
        return { valid: false, error: 'ملف النسخة الاحتياطية فارغ (حجمه 0 بايت)' };
    }

    // Check SQLite header
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (buffer.toString('utf-8', 0, 15) !== 'SQLite format 3') {
        return { valid: false, error: 'ملف قاعدة البيانات غير صالح أو ليس بصيغة SQLite معتمدة' };
    }

    let tempDb = null;
    try {
        tempDb = new Database(filePath, { readonly: true, fileMustExist: true });

        // 1. SQLite Integrity Check
        const integrityResult = tempDb.pragma('integrity_check');
        if (!integrityResult || integrityResult[0]?.integrity_check !== 'ok') {
            return { valid: false, error: 'فحص النزاهة الهيكلية فشل: ملف قاعدة البيانات تالف أو غير مكتمل' };
        }

        // 2. Foreign Key Check
        const fkViolations = tempDb.pragma('foreign_key_check');
        if (fkViolations.length > 0) {
            console.warn('Backup validation warning: FK violations found:', fkViolations.length);
        }

        // 3. Schema Completeness Verification
        const requiredTables = [
            'customers',
            'suppliers',
            'workers',
            'credit_sales',
            'purchases',
            'inventory_items',
            'treasury_transactions',
            'financial_accounts',
            'users',
            'system_settings',
            'financial_periods',
            'audit_logs'
        ];

        const tablesInDb = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
        const missingTables = requiredTables.filter(t => !tablesInDb.includes(t));

        if (missingTables.length > 0) {
            return {
                valid: false,
                error: `ملف النسخة الاحتياطية غير متوافق: تنقصه الجداول التالية (${missingTables.join(', ')})`
            };
        }

        // 4. Summarize Record Counts
        const counts = {};
        for (const tbl of requiredTables) {
            try {
                counts[tbl] = tempDb.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get().c;
            } catch(e) {
                counts[tbl] = 0;
            }
        }

        return {
            valid: true,
            tablesCount: tablesInDb.length,
            recordsSummary: counts,
            sizeMB: (stat.size / (1024 * 1024)).toFixed(2)
        };
    } catch (err) {
        return { valid: false, error: `خطأ أثناء فحص الملف: ${err.message}` };
    } finally {
        if (tempDb) {
            try { tempDb.close(); } catch(e){}
        }
    }
}

/**
 * Creates a safe, consistent backup of the current production database.
 */
function createBackup(notes = 'نسخة احتياطية يدوية', targetPath = null) {
    ensureDirectories();
    const timestampStr = formatDateForFilename();
    const dbPath = db.getActiveDatabasePath();
    const fileName = `AlHajjRefaat_Backup_${timestampStr}.db`;
    const backupPath = targetPath || path.join(BACKUP_DIR, fileName);

    try {
        const rawDb = db.getRawInstance();
        
        // Remove existing file if present at target path
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }

        // Use VACUUM INTO for non-blocking WAL live backup creation
        rawDb.prepare('VACUUM INTO ?').run(backupPath);

        // Validate the newly created backup
        const validation = validateBackupFile(backupPath);
        if (!validation.valid) {
            try { fs.unlinkSync(backupPath); } catch(e){}
            throw new Error(`فشل التحقق من صحة النسخة الاحتياطية المنشأة: ${validation.error}`);
        }

        const sizeMB = validation.sizeMB;
        const nowIso = new Date().toISOString();

        // Save persistent metadata in system_settings
        if (!db.isTestDatabase()) {
            try {
                const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
                upsert.run('last_successful_backup_time', nowIso);
                upsert.run('last_successful_backup_filename', path.basename(backupPath));
                upsert.run('last_successful_backup_path', backupPath);
                upsert.run('last_successful_backup_size_mb', String(sizeMB));
            } catch (metaErr) {
                console.warn('Warning updating backup metadata:', metaErr.message);
            }
        }

        auditLogger.logAction(
            'مستخدم النظام',
            'BACKUP_CREATE',
            'إعدادات النظام',
            'نسخ احتياطي',
            path.basename(backupPath),
            `تم إنشاء نسخة احتياطية معتمدة لقاعدة البيانات بحجم ${sizeMB} MB: ${notes}`
        );

        return {
            success: true,
            fileName: path.basename(backupPath),
            path: backupPath,
            sizeMB,
            createdAt: nowIso
        };
    } catch (err) {
        console.error('Backup creation error:', err);
        throw new Error(`فشل إنشاء النسخة الاحتياطية: ${err.message}`);
    }
}

/**
 * Automatically creates a safety backup of the current production database before restoration.
 */
function createSafetyBackup() {
    ensureDirectories();
    const timestampStr = `${formatDateForFilename()}_${Date.now()}`;
    const fileName = `PreRestore_Backup_${timestampStr}.db`;
    const safetyPath = path.join(PRE_RESTORE_DIR, fileName);

    try {
        if (fs.existsSync(safetyPath)) {
            try { fs.unlinkSync(safetyPath); } catch(e){}
        }

        const rawDb = db.getRawInstance();
        rawDb.prepare('VACUUM INTO ?').run(safetyPath);

        const validation = validateBackupFile(safetyPath);
        if (!validation.valid) {
            try { fs.unlinkSync(safetyPath); } catch(e){}
            throw new Error(`فشل إنشاء نسخة الأمان الوقائية: ${validation.error}`);
        }

        return safetyPath;
    } catch (err) {
        console.error('Safety backup creation failed:', err);
        throw new Error(`تعذر إنشاء نسخة الأمان الوقائية قبل الاستعادة: ${err.message}`);
    }
}

/**
 * Safely restores the active persistent database from a validated backup file.
 */
function restoreBackup(backupFilePath, user = 'المدير العام') {
    ensureDirectories();

    // 1. Validate candidate backup file before touching current DB
    const validation = validateBackupFile(backupFilePath);
    if (!validation.valid) {
        throw new Error(`ملف النسخة الاحتياطية غير صالح أو تالف، ولم يتم تغيير البيانات الحالية: ${validation.error}`);
    }

    // 2. Create Safety Backup of current production database
    console.log('Creating safety backup of active database before restoration...');
    const safetyBackupPath = createSafetyBackup();
    console.log(`Safety backup created successfully at: ${safetyBackupPath}`);

    const activeDbPath = db.getActiveDatabasePath();

    try {
        // 3. Close active SQLite connection cleanly
        console.log(`Closing active database connection to: ${activeDbPath}`);
        db.closeConnection();

        // Remove lingering WAL / SHM files next to active database
        const walPath = `${activeDbPath}-wal`;
        const shmPath = `${activeDbPath}-shm`;
        if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch(e){}
        if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch(e){}

        // 4. Copy candidate backup file over active database
        fs.copyFileSync(backupFilePath, activeDbPath);

        // 5. Reopen active database connection
        db.initDb(activeDbPath);

        // Verify reopened database connection with a query
        const checkQuery = db.prepare('SELECT COUNT(*) as c FROM system_settings').get();
        if (checkQuery === undefined) {
            throw new Error('فشل الاستعلام التشخيصي بعد إعادة فتح قاعدة البيانات');
        }

        // Update persistent metadata
        try {
            const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
            upsert.run('last_restore_time', new Date().toISOString());
            upsert.run('last_restore_filename', path.basename(backupFilePath));
        } catch(e){}

        auditLogger.logAction(
            user,
            'BACKUP_RESTORE',
            'إعدادات النظام',
            'استعادة البيانات',
            path.basename(backupFilePath),
            `تمت استعادة قاعدة البيانات بنجاح من النسخة الاحتياطية ${path.basename(backupFilePath)}. (نسخة الأمان الاحتياطية: ${path.basename(safetyBackupPath)})`
        );

        return {
            success: true,
            message: 'تم استرجاع قاعدة البيانات بنجاح المعتمدة وحقن كافة الحسابات بنجاح',
            safetyBackup: safetyBackupPath,
            summary: validation.recordsSummary
        };
    } catch (restoreErr) {
        console.error('CRITICAL RESTORE ERROR, ROLLING BACK TO SAFETY BACKUP:', restoreErr);

        // ROLLBACK PATH
        try {
            db.closeConnection();
            const walPath = `${activeDbPath}-wal`;
            const shmPath = `${activeDbPath}-shm`;
            if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch(e){}
            if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch(e){}

            fs.copyFileSync(safetyBackupPath, activeDbPath);
            db.initDb(activeDbPath);
            console.log('Successfully rolled back to safety backup.');
        } catch (rollbackErr) {
            console.error('Rollback failure:', rollbackErr);
        }

        throw new Error(`ملف النسخة الاحتياطية غير صالح أو تالف، ولم يتم تغيير البيانات الحالية. (تفاصيل: ${restoreErr.message})`);
    }
}

/**
 * Returns detailed metadata for the last successful backup.
 */
function getLastBackupInfo() {
    ensureDirectories();
    const activeDbPath = db.getActiveDatabasePath();

    let meta = {
        available: false,
        status: '🟢 تعمل بشكل ممتاز (محمية ومحدثة)',
        last_backup: 'لم يتم إنشاء نسخة احتياطية بعد',
        file_name: 'لا يوجد',
        file_size: '-',
        file_exists: false,
        db_size_mb: '0 MB'
    };

    if (fs.existsSync(activeDbPath)) {
        const liveStat = fs.statSync(activeDbPath);
        meta.db_size_mb = `${(liveStat.size / (1024 * 1024)).toFixed(2)} MB`;
        meta.file_size = meta.db_size_mb;
    }

    try {
        const rows = db.prepare("SELECT key, value FROM system_settings WHERE key LIKE 'last_successful_backup_%'").all();
        const map = {};
        rows.forEach(r => map[r.key] = r.value);

        if (map.last_successful_backup_time && map.last_successful_backup_filename) {
            const backupPath = map.last_successful_backup_path || path.join(BACKUP_DIR, map.last_successful_backup_filename);
            const exists = fs.existsSync(backupPath);
            const formattedDate = new Date(map.last_successful_backup_time).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });

            meta.available = true;
            meta.last_backup = formattedDate;
            meta.file_name = map.last_successful_backup_filename;
            meta.file_size = map.last_successful_backup_size_mb ? `${map.last_successful_backup_size_mb} MB` : meta.db_size_mb;
            meta.file_exists = exists;
            if (!exists) {
                meta.status = '⚠️ الملف السابق غير متوفر على القرص';
            }
        } else {
            // Fallback: Check BACKUP_DIR for newest file
            const files = listBackups();
            if (files.length > 0) {
                const newest = files[0];
                meta.available = true;
                meta.last_backup = new Date(newest.createdAt).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
                meta.file_name = newest.fileName;
                meta.file_size = `${newest.sizeMB} MB`;
                meta.file_exists = true;
            }
        }
    } catch (e) {
        console.error('Error fetching last backup info:', e);
    }

    return meta;
}

function listBackups() {
    ensureDirectories();
    const files = fs.readdirSync(BACKUP_DIR);
    return files
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const fullPath = path.join(BACKUP_DIR, f);
            const stat = fs.statSync(fullPath);
            return {
                fileName: f,
                path: fullPath,
                sizeMB: Math.round((stat.size / 1024 / 1024) * 100) / 100,
                createdAt: stat.birthtime || stat.mtime
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function initScheduledBackups() {
    console.log('Initializing scheduled automated backup service for Al-Hajj Refaat...');
    setInterval(() => {
        try {
            console.log('Running automatic scheduled backup...');
            createBackup('نسخة احتياطية آليّة دورية');
        } catch (err) {
            console.error('Scheduled backup error:', err.message);
        }
    }, 24 * 60 * 60 * 1000);
}

module.exports = {
    createBackup,
    validateBackupFile,
    createSafetyBackup,
    restoreBackup,
    getLastBackupInfo,
    listBackups,
    initScheduledBackups
};
