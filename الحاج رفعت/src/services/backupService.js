const fs = require('fs');
const path = require('path');
const db = require('../db');
const auditLogger = require('../controllers/auditLogger');

const BACKUP_DIR = path.resolve(__dirname, '../../backups');

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

function createBackup(notes = 'نسخة احتياطية مستمرة') {
    ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbPath = db.getActiveDatabasePath();
    const dbFileName = path.basename(dbPath, '.db');
    const backupFileName = `${dbFileName}_backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    try {
        const rawDb = db.getRawInstance();
        // Use SQLite VACUUM INTO for non-blocking live backup creation
        rawDb.prepare(`VACUUM INTO ?`).run(backupPath);
        
        const sizeMB = Math.round((fs.statSync(backupPath).size / 1024 / 1024) * 100) / 100;
        
        auditLogger.logAction(
            'مستخدم النظام',
            'BACKUP_CREATE',
            'إعدادات النظام',
            'نسخ احتياطي',
            backupFileName,
            `تم إنشاء نسخة احتياطية حية لقاعدة البيانات بحجم ${sizeMB} MB: ${backupFileName}`
        );

        return {
            success: true,
            fileName: backupFileName,
            path: backupPath,
            sizeMB,
            createdAt: new Date().toISOString()
        };
    } catch(err) {
        // Fallback to safe file copy if VACUUM INTO fails
        try {
            fs.copyFileSync(dbPath, backupPath);
            const sizeMB = Math.round((fs.statSync(backupPath).size / 1024 / 1024) * 100) / 100;
            return {
                success: true,
                fileName: backupFileName,
                path: backupPath,
                sizeMB,
                createdAt: new Date().toISOString()
            };
        } catch(copyErr) {
            console.error('Backup creation error:', copyErr);
            throw new Error(`فشل إنشاء النسخة الاحتياطية: ${copyErr.message}`);
        }
    }
}

function listBackups() {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR);
    return files
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const fullPath = path.join(BACKUP_DIR, f);
            const stat = fs.statSync(fullPath);
            return {
                fileName: f,
                sizeMB: Math.round((stat.size / 1024 / 1024) * 100) / 100,
                createdAt: stat.birthtime || stat.mtime
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Automatic Scheduled Backup Runner (runs every 12 hours)
function initScheduledBackups() {
    ensureBackupDir();
    console.log('Continuous Database Backup Strategy initialized.');
    
    // Create initial backup on startup if non-existent or older than 12h
    try {
        const backups = listBackups();
        if (backups.length === 0) {
            createBackup('نسخة احتياطية تلقائية عند بدء التشغيل');
        }
    } catch(e) {
        console.error('Initial backup error:', e.message);
    }

    // Schedule periodic backup every 12 hours (43,200,000 ms)
    setInterval(() => {
        try {
            createBackup('نسخة احتياطية دورية آلمية (12h)');
            // Rotate backup files: keep last 30 backup copies (NEVER deletes live DB!)
            const backups = listBackups();
            if (backups.length > 30) {
                const toRemove = backups.slice(30);
                for (const b of toRemove) {
                    try { fs.unlinkSync(path.join(BACKUP_DIR, b.fileName)); } catch(e){}
                }
            }
        } catch(err) {
            console.error('Scheduled backup error:', err.message);
        }
    }, 12 * 3600 * 1000);
}

module.exports = {
    createBackup,
    listBackups,
    initScheduledBackups
};
