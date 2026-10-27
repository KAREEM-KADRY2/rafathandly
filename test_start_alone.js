const cp = require('child_process');
const path = require('path');

const targetDir = 'C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت';
console.log('Testing Start-AlHajjRefaat.exe...');

// Execute Start-AlHajjRefaat.exe using cmd
cp.execSync('cmd.exe /c "Start-AlHajjRefaat.exe"', { cwd: targetDir });

console.log('Start-AlHajjRefaat.exe finished. Waiting 6 seconds to see if node is running...');
setTimeout(() => {
    try {
        const out = cp.execSync('powershell "Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path"').toString();
        console.log('Node processes:');
        console.log(out);
    } catch (e) {
        console.log('Error checking process:', e.message);
    }
}, 6000);
