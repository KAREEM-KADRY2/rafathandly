const fs = require('fs');
const path = require('path');

function search(dir) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (f === 'node_modules' || f === 'dist') continue;
        const stat = fs.statSync(p);
        if (stat.isDirectory()) search(p);
        else if (f.endsWith('.js')) {
            const content = fs.readFileSync(p, 'utf8');
            const lines = content.split('\n');
            lines.forEach((l, idx) => {
                if (l.includes('="') || l.includes('= "')) {
                    if (l.includes('prepare') || l.includes('SELECT') || l.includes('DELETE') || l.includes('UPDATE')) {
                        console.log(`${p}:${idx + 1}: ${l.trim()}`);
                    }
                }
            });
        }
    }
}

search('c:/Users/xps/Desktop/الحاج رفعت/backend/src');
