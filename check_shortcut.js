const fs = require('fs');
const buf = fs.readFileSync('C:/Users/xps/Desktop/Alhaj-Refaat-System.lnk', 'utf-8');
console.log(buf.slice(0, 500));
