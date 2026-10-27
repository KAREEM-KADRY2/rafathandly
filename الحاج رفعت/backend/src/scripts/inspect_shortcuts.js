const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopDirs = [
    path.join(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'Desktop'),
    path.join(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive', 'Desktop'),
    'C:\\Users\\Public\\Desktop'
];

console.log('=== DESKTOP SHORTCUT AUDIT ===');
desktopDirs.forEach(dir => {
    console.log(`\nChecking Directory: ${dir}`);
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        let count = 0;
        files.forEach(f => {
            if (f.endsWith('.lnk')) {
                count++;
                const fullPath = path.join(dir, f);
                try {
                    const psCommand = `& { param($p); $sh = New-Object -ComObject WScript.Shell; $sc = $sh.CreateShortcut($p); Write-Host "TARGET:" $sc.TargetPath; Write-Host "WORKDIR:" $sc.WorkingDirectory; Write-Host "ARGS:" $sc.Arguments }`;
                    const out = execFileSync('powershell', ['-NoProfile', '-Command', psCommand, fullPath], { encoding: 'utf8' });
                    console.log(`\nShortcut Name: ${f}`);
                    console.log(`  Full Path: ${fullPath}`);
                    out.trim().split('\n').forEach(l => console.log(`  ${l.trim()}`));
                } catch (e) {
                    console.error(`  Error reading ${f}: ${e.message}`);
                }
            }
        });
        if (count === 0) console.log('  No .lnk files found.');
    } else {
        console.log('  (Directory does not exist)');
    }
});
