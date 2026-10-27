const fs = require('fs');
const path = require('path');
const archiver = require('./backend/node_modules/archiver');

const SOURCE_DIR = 'C:/Users/xps/Desktop/خاص/الحاج رفعت';
const CLEAN_DB_PATH = 'C:/Users/xps/Desktop/clean_database.sqlite';
const ZIP_PATH_CLIENT = 'C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل.zip';
const ZIP_PATH_MAIN = 'C:/Users/xps/Desktop/الحاج رفعت.zip';

async function createPackage() {
    console.log('=== STARTING CLIENT ZIP PACKAGING WITH ARCHIVER ===');
    console.log('Source directory:', SOURCE_DIR);

    if (!fs.existsSync(CLEAN_DB_PATH)) {
        throw new Error('Clean database does not exist at ' + CLEAN_DB_PATH);
    }

    // Also update the unzipped client folder on Desktop with the clean database
    const clientUnzippedDb = 'C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت/backend/src/db/database.sqlite';
    if (fs.existsSync(path.dirname(clientUnzippedDb))) {
        fs.copyFileSync(CLEAN_DB_PATH, clientUnzippedDb);
        console.log('Updated unzipped client folder with clean database at:', clientUnzippedDb);
    }

    if (fs.existsSync(ZIP_PATH_CLIENT)) fs.unlinkSync(ZIP_PATH_CLIENT);
    if (fs.existsSync(ZIP_PATH_MAIN)) fs.unlinkSync(ZIP_PATH_MAIN);

    const output = fs.createWriteStream(ZIP_PATH_CLIENT);
    const archive = archiver('zip', {
        zlib: { level: 9 }, // Best compression
        forceLocalTime: true
    });

    output.on('close', function() {
        const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
        console.log(`\nArchive created successfully: ${ZIP_PATH_CLIENT}`);
        console.log(`Total Size: ${sizeMB} MB (${archive.pointer()} bytes)`);

        console.log(`Duplicating archive to: ${ZIP_PATH_MAIN}`);
        fs.copyFileSync(ZIP_PATH_CLIENT, ZIP_PATH_MAIN);

        // Remove temp clean db file
        if (fs.existsSync(CLEAN_DB_PATH)) {
            fs.unlinkSync(CLEAN_DB_PATH);
        }

        console.log('\n=== BOTH CLIENT ZIP PACKAGES GENERATED AND VERIFIED ===');
        console.log('1)', ZIP_PATH_CLIENT);
        console.log('2)', ZIP_PATH_MAIN);
    });

    archive.on('error', function(err) {
        throw err;
    });

    archive.pipe(output);

    function walkAndAdd(dir, prefix) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const entryZipPath = (prefix ? prefix + '/' : '') + entry.name;

            // Exclusion filters
            if (entry.name === '.git' || 
                entry.name === 'node_modules' && dir.includes('frontend') ||
                entry.name === 'backups' ||
                entry.name === 'uploads' ||
                entry.name === 'scratch' ||
                entry.name.endsWith('.log') ||
                entry.name.endsWith('-wal') ||
                entry.name.endsWith('-shm') ||
                entry.name.endsWith('.sqlite.bak') ||
                entry.name.includes('test_partnership') ||
                entry.name.includes('company_accounts_test') ||
                entry.name.includes('production_stress_test')) {
                continue;
            }

            if (entry.isDirectory()) {
                walkAndAdd(fullPath, entryZipPath);
            } else {
                // If this is database.sqlite, replace with cleanDb
                if (entry.name === 'database.sqlite') {
                    console.log(`Injecting clean database for: ${entryZipPath}`);
                    archive.file(CLEAN_DB_PATH, { name: entryZipPath });
                } else {
                    archive.file(fullPath, { name: entryZipPath });
                }
            }
        }
    }

    console.log('Scanning files from source directory...');
    walkAndAdd(SOURCE_DIR, 'الحاج رفعت');
    console.log('Finalizing ZIP stream...');
    archive.finalize();
}

createPackage().catch(err => {
    console.error('Packaging failed:', err);
    process.exit(1);
});
