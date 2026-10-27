const fs = require('fs');
const JSZip = require('C:/Users/xps/Desktop/الحاج رفعت/الحاج رفعت/backend/node_modules/jszip');

async function test() {
    console.log('Loading zip...');
    const data = fs.readFileSync('C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل.zip');
    const zip = await JSZip.loadAsync(data);
    const files = Object.keys(zip.files);
    console.log('Total files in zip:', files.length);

    const important = [
        'runtime/node.exe',
        'backend/node.exe',
        'Start-AlHajjRefaat.exe',
        'Stop-AlHajjRefaat.exe',
        'Create-Desktop-Shortcut.exe',
        'Start-System.bat',
        'تشغيل_النظام.bat',
        'index.js',
        'backend/index.js',
        'backend/src/db/database.sqlite',
        'frontend/dist/index.html',
        'dist/index.html'
    ];

    console.log('\n--- Checking important files ---');
    for (const item of important) {
        const matches = files.filter(f => f.endsWith(item));
        console.log(item, '=>', matches.length > 0 ? matches.join(', ') : 'MISSING!');
    }

    // Check root files
    console.log('\n--- Root level entries ---');
    const roots = files.filter(f => f.split('/').length <= 2);
    console.log(roots);
}

test().catch(err => console.error(err));
