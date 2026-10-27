const fs = require('fs');
const path = require('path');

const temp = 'C:/Users/xps/AppData/Local/Temp';
const now = Date.now();
const files = fs.readdirSync(temp);
for (const f of files) {
    try {
        const full = path.join(temp, f);
        const stat = fs.statSync(full);
        if (now - stat.mtimeMs < 2 * 60 * 60 * 1000) { // last 2 hours
            console.log(f, stat.isDirectory() ? '[DIR]' : '[FILE]', stat.mtime);
        }
    } catch (e) {}
}
