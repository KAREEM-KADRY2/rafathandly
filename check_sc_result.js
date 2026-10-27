const fs = require('fs');

const d = fs.readdirSync('C:/Users/xps/Desktop');
console.log('Desktop .lnk files:', d.filter(f => f.endsWith('.lnk')));

for (const name of ['Alhaj-Refaat-System.lnk', 'نظام الحاج رفعت.lnk']) {
    const p = 'C:/Users/xps/Desktop/' + name;
    if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        console.log(`Shortcut ${name}: Size = ${stat.size} bytes, modified = ${stat.mtime}`);
    } else {
        console.log(`Shortcut ${name}: NOT FOUND`);
    }
}
