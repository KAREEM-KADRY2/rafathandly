const cp = require('child_process');
const path = require('path');

const targetDir = 'C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت';
console.log('Testing execution of Start-AlHajjRefaat.exe in:', targetDir);

try {
    const proc = cp.spawn(path.join(targetDir, 'Start-AlHajjRefaat.exe'), [], {
        cwd: targetDir,
        detached: true,
        stdio: 'pipe'
    });

    proc.stdout.on('data', d => console.log('STDOUT:', d.toString()));
    proc.stderr.on('data', d => console.log('STDERR:', d.toString()));
    proc.on('exit', code => console.log('EXIT CODE:', code));
    proc.on('error', err => console.log('ERROR:', err));

    setTimeout(() => {
        console.log('Checking processes after 5 seconds...');
        const pList = cp.execSync('powershell "Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path"').toString();
        console.log(pList);
    }, 5000);
} catch (e) {
    console.error('Spawn exception:', e);
}
