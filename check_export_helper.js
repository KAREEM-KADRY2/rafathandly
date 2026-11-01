const fs = require('fs');
const content = fs.readFileSync('C:/Users/xps/Desktop/الحاج رفعت/frontend/src/utils/reportExportHelper.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes("case 'sales':") || line.includes("case 'profit-loss':")) {
        console.log(`\n=== Line ${i + 1} ===`);
        console.log(lines.slice(i, i + 35).join('\n'));
    }
});
