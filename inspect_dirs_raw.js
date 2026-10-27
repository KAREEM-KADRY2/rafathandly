const fs = require('fs');
const path = require('path');

const entries = fs.readdirSync('C:/Users/xps/Desktop');
for (const e of entries) {
    if (e.includes('Ø') || e.includes('نسخة') || e.includes('رفعت')) {
        const full = path.join('C:/Users/xps/Desktop', e);
        const stat = fs.statSync(full);
        console.log({
            name: e,
            isDir: stat.isDirectory(),
            mtime: stat.mtime
        });
        if (stat.isDirectory()) {
            try {
                console.log('   contents:', fs.readdirSync(full));
            } catch (err) {
                console.log('   error:', err.message);
            }
        }
    }
}
