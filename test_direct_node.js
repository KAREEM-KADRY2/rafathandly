const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت';
const nodeExe = path.join(targetDir, 'runtime', 'node.exe');

console.log('Spawning node directly...');
const p = cp.spawn(nodeExe, ['index.js'], {
    cwd: targetDir
});

const logStream = fs.createWriteStream(path.join(targetDir, 'direct_run.log'));

p.stdout.pipe(logStream, { end: false });
p.stderr.pipe(logStream, { end: false });

p.stdout.on('data', d => console.log('[OUT]', d.toString()));
p.stderr.on('data', d => console.log('[ERR]', d.toString()));

p.on('exit', (code, signal) => {
    console.log(`Node EXITED with code ${code}, signal ${signal}`);
});

setTimeout(() => {
    console.log('15s reached. Checking health...');
    cp.exec('powershell "Invoke-RestMethod http://127.0.0.1:5000/api/health"', (err, stdout) => {
        if (err) console.log('Health check failed:', err.message);
        else console.log('Health check OK:', stdout);
        p.kill();
    });
}, 15000);
