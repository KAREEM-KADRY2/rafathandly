const fs = require('fs');
const path = require('path');

const desktop = 'C:/Users/xps/Desktop';
const dirs = fs.readdirSync(desktop);
for (const d of dirs) {
    const full = path.join(desktop, d);
    try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            console.log('DIR:', d, '=> files:', fs.readdirSync(full).length);
        }
    } catch (e) {
        console.log('Error reading:', d, e.message);
    }
}
