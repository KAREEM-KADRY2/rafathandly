const fs = require('fs');
const modules = fs.readdirSync('C:/Users/xps/Desktop/الحاج رفعت/الحاج رفعت/backend/node_modules');
console.log(modules.filter(m => m.includes('zip') || m.includes('archive') || m.includes('tar')));
