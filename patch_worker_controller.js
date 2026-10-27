const fs = require('fs');

const files = [
    'c:/Users/xps/Desktop/الحاج رفعت/backend/src/controllers/workerController.js',
    'c:/Users/xps/Desktop/الحاج رفعت/الحاج رفعت/backend/src/controllers/workerController.js',
    'c:/Users/xps/Desktop/خاص/الحاج رفعت/backend/src/controllers/workerController.js'
];

for (const f of files) {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        const oldCode = `db.prepare('DELETE FROM opening_balances WHERE entity_type = "worker" AND entity_id = ?').run(id);`;
        const newCode = `db.prepare("DELETE FROM opening_balances WHERE entity_type = 'worker' AND entity_id = ?").run(id);`;
        if (content.includes(oldCode)) {
            content = content.replace(oldCode, newCode);
            fs.writeFileSync(f, content, 'utf8');
            console.log('Fixed workerController.js in:', f);
        } else {
            console.log('Pattern not found in:', f);
        }
    }
}
