const cp = require('child_process');
const path = require('path');

const targetDir = 'C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت';
console.log('Running Start-System.bat in:', targetDir);

const child = cp.spawn('cmd.exe', ['/c', 'Start-System.bat'], {
    cwd: targetDir,
    stdio: 'pipe'
});

child.stdout.on('data', d => console.log('OUT:', d.toString()));
child.stderr.on('data', d => console.log('ERR:', d.toString()));

setTimeout(() => {
    console.log('5s check...');
    child.kill();
}, 6000);
