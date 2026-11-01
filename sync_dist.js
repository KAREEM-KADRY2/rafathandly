const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, 'frontend/dist');
const targets = [
    path.resolve(__dirname, 'dist'),
    path.resolve(__dirname, 'backend/dist')
];

function copyDir(source, target) {
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    
    // Clear old files in target first
    for (const f of fs.readdirSync(target)) {
        const curPath = path.join(target, f);
        if (fs.lstatSync(curPath).isDirectory()) {
            fs.rmSync(curPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(curPath);
        }
    }

    for (const item of fs.readdirSync(source)) {
        const s = path.join(source, item);
        const d = path.join(target, item);
        if (fs.lstatSync(s).isDirectory()) {
            copySubDir(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

function copySubDir(source, target) {
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    for (const item of fs.readdirSync(source)) {
        const s = path.join(source, item);
        const d = path.join(target, item);
        if (fs.lstatSync(s).isDirectory()) {
            copySubDir(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

for (const t of targets) {
    copyDir(src, t);
    console.log(`Dist synced to: ${t}`);
    console.log(`Assets in ${t}:`, fs.readdirSync(path.join(t, 'assets')));
}
