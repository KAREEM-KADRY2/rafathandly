const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

console.log('=== CREATING & VERIFYING DESKTOP SHORTCUT ===');

const psScriptPath = path.resolve(__dirname, 'create_client_shortcut.ps1');

try {
    const output = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScriptPath], { encoding: 'utf8' });
    console.log(output);
} catch (err) {
    console.error('Error executing shortcut script:', err.message);
    if (err.stdout) console.log('Stdout:', err.stdout);
    if (err.stderr) console.error('Stderr:', err.stderr);
    process.exit(1);
}
