const fs = require('fs');
const path = require('path');
const archiver = require('./backend/node_modules/archiver');

const SOURCE_DIR = 'C:/Users/xps/Desktop/الحاج رفعت';
const CLEAN_DB_PATH = 'C:/Users/xps/Desktop/clean_database.sqlite';
const ZIP_PATH_CLIENT = 'C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل.zip';
const ZIP_PATH_MAIN = 'C:/Users/xps/Desktop/الحاج رفعت.zip';
const ZIP_PATH_ABDELRAZIK = 'C:/Users/xps/Desktop/عبد الرواق.zip';

async function createPackage() {
    console.log('=== STARTING CLEAN CLIENT ZIP PACKAGING ===');
    console.log('Source directory:', SOURCE_DIR);

    if (!fs.existsSync(CLEAN_DB_PATH)) {
        throw new Error('Clean database does not exist at ' + CLEAN_DB_PATH);
    }

    if (fs.existsSync(ZIP_PATH_CLIENT)) fs.unlinkSync(ZIP_PATH_CLIENT);
    if (fs.existsSync(ZIP_PATH_MAIN)) fs.unlinkSync(ZIP_PATH_MAIN);
    if (fs.existsSync(ZIP_PATH_ABDELRAZIK)) fs.unlinkSync(ZIP_PATH_ABDELRAZIK);

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

        console.log(`Duplicating archive to: ${ZIP_PATH_ABDELRAZIK}`);
        fs.copyFileSync(ZIP_PATH_CLIENT, ZIP_PATH_ABDELRAZIK);

        console.log('\n=== ALL 3 CLEAN CLIENT ZIP PACKAGES GENERATED SUCCESSFULLY ===');
        console.log('1)', ZIP_PATH_CLIENT);
        console.log('2)', ZIP_PATH_MAIN);
        console.log('3)', ZIP_PATH_ABDELRAZIK);
    });

    archive.on('error', function(err) {
        throw err;
    });

    archive.pipe(output);

    // List of temp / test scripts to exclude from client package
    const excludedFiles = new Set([
        'build_launchers.js',
        'check_all_counts.js',
        'check_all_fks.js',
        'check_config_tables.js',
        'check_dbs.js',
        'check_desktop_dirs.js',
        'check_proc.ps1',
        'check_root_files.ps1',
        'check_sc_result.js',
        'check_shortcut.js',
        'check_subtrees.js',
        'check_worker_tables.js',
        'check_zip.ps1',
        'check_zip_contents.ps1',
        'CreateShortcut.cs',
        'decompile.ps1',
        'direct_run.log',
        'distribute_dist.js',
        'find_double_quotes_sql.js',
        'find_recent.js',
        'find_temp.js',
        'find_zip_mod.js',
        'generate_clean_db.js',
        'get_bat_str.ps1',
        'get_sc.ps1',
        'inspect_dirs_raw.js',
        'inspect_exe.js',
        'inspect_shortcut_maker.js',
        'inspect_zip.js',
        'make_check2.js',
        'make_clean_client_zip.js',
        'make_desktop_sc.ps1',
        'make_ps1.js',
        'monitor_run.ps1',
        'package_client_zip.js',
        'patch_barsal_controller.js',
        'patch_barsal_report.js',
        'patch_inline_truck.js',
        'patch_vehicle_details.js',
        'patch_vehicles_list.js',
        'patch_worker_controller.js',
        'read_calls.ps1',
        'read_il.ps1',
        'read_package_zip.js',
        'reflect.ps1',
        'run_check_proc.js',
        'run_decompile.js',
        'run_get_bat_str.js',
        'run_get_sc.js',
        'run_make_sc.js',
        'run_monitor.js',
        'run_read_calls.js',
        'run_read_il.js',
        'run_reflect.js',
        'StartLauncher.cs',
        'StopProgram.cs',
        'sync_all_updates.js',
        'sync_files.js',
        'sync_files.ps1',
        'test_bat.js',
        'test_crash.log',
        'test_delete_step.js',
        'test_direct_node.js',
        'test_ishell.cs',
        'test_ishell.exe',
        'test_start_alone.js',
        'test_start_exe.js',
        'test_worker_del.js',
        'test_zip.js',
        'TestCreateShortcut.exe',
        'TestLauncher.exe',
        'TestStop.exe',
        'update_backend_index.js',
        'update_bats.js',
        'update_desktop_bat.js'
    ]);

    function walkAndAdd(dir, prefix) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const entryZipPath = (prefix ? prefix + '/' : '') + entry.name;

            // Exclusion filters
            if (entry.name === '.git' || 
                (entry.name === 'node_modules' && dir.includes('frontend')) ||
                entry.name === 'backups' ||
                entry.name === 'uploads' ||
                entry.name === 'scratch' ||
                entry.name === 'الحاج رفعت' && dir === SOURCE_DIR || // avoid nested copy of self
                excludedFiles.has(entry.name) ||
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
                // If this is database.sqlite, replace with clean database!
                if (entry.name === 'database.sqlite') {
                    console.log(`[CLEAN DB INJECTION] Injecting clean database for: ${entryZipPath}`);
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
