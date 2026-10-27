const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

const sources = [
    {
        cs: 'C:\\Users\\xps\\Desktop\\الحاج رفعت\\StartLauncher.cs',
        exe: 'Start-AlHajjRefaat.exe',
        refs: '/reference:System.Windows.Forms.dll'
    },
    {
        cs: 'C:\\Users\\xps\\Desktop\\الحاج رفعت\\CreateShortcut.cs',
        exe: 'Create-Desktop-Shortcut.exe',
        refs: '/reference:System.Windows.Forms.dll'
    },
    {
        cs: 'C:\\Users\\xps\\Desktop\\الحاج رفعت\\StopProgram.cs',
        exe: 'Stop-AlHajjRefaat.exe',
        refs: '/reference:System.Windows.Forms.dll'
    }
];

const targetDirs = [
    'C:/Users/xps/Desktop/الحاج رفعت/الحاج رفعت',
    'C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت',
    'C:/Users/xps/Desktop/خاص/الحاج رفعت'
];

for (const s of sources) {
    const tempOut = path.join('C:\\Users\\xps\\Desktop\\الحاج رفعت', s.exe);
    const cmd = `"${csc}" /codepage:65001 /target:winexe /out:"${tempOut}" ${s.refs} "${s.cs}"`;
    console.log('Compiling with UTF-8:', s.exe);
    cp.execSync(cmd);
    console.log('Successfully compiled:', s.exe);

    for (const d of targetDirs) {
        if (fs.existsSync(d)) {
            const dest = path.join(d, s.exe);
            fs.copyFileSync(tempOut, dest);
            console.log('  -> Copied to:', dest);
        }
    }
}

console.log('All launchers successfully built and distributed with /codepage:65001!');
