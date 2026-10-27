const fs = require('fs');
const path = require('path');

const candidates = [
    'C:/Users/xps/AppData/Local/Temp',
    'C:/Users/xps/Downloads',
    'C:/Users/xps/Desktop',
    'C:/Users/xps'
];

const now = Date.now();
const oneHour = 60 * 60 * 1000;

for (const dir of candidates) {
    try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
            try {
                const full = path.join(dir, f);
                const stat = fs.statSync(full);
                if (now - stat.mtimeMs < oneHour) {
                    if (f.includes('الحاج') || f.includes('Refaat') || f.includes('Alhaj') || f.includes('Temp') || f.includes('Zip')) {
                        console.log('Recent:', full, 'mtime:', stat.mtime);
                    }
                }
            } catch (e) {}
        }
    } catch (e) {}
}
