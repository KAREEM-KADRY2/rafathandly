const fs = require('fs');
const p = 'c:/Users/xps/Desktop/الحاج رفعت/backend/src/controllers/barsalController.js';
let content = fs.readFileSync(p, 'utf8');

const target = `exports.remove = (req, res) => {
    try {
        const info = db.prepare('DELETE FROM barsal_records WHERE id = ?').run(req.params.id);
        if (info.changes === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'تم الحذف بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};`;

const addition = `exports.remove = (req, res) => {
    try {
        const info = db.prepare('DELETE FROM barsal_records WHERE id = ?').run(req.params.id);
        if (info.changes === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'تم الحذف بنجاح' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.removeParcel = (req, res) => {
    const { villa, barsal } = req.body;
    try {
        if (!barsal) return res.status(400).json({ error: 'اسم البرسل مطلوب' });
        let query = 'DELETE FROM barsal_records WHERE barsal = ?';
        const params = [barsal];
        if (villa && villa !== 'all' && villa !== 'الكل') {
            query += ' AND villa = ?';
            params.push(villa);
        }
        const info = db.prepare(query).run(...params);
        res.json({ message: \`تم حذف \${info.changes} حركة بنجاح\` });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};`;

if (content.includes(target)) {
    content = content.replace(target, addition);
    fs.writeFileSync(p, content, 'utf8');
    console.log('Successfully updated barsalController.js (LF)');
} else if (content.includes(target.replace(/\n/g, '\r\n'))) {
    content = content.replace(target.replace(/\n/g, '\r\n'), addition.replace(/\n/g, '\r\n'));
    fs.writeFileSync(p, content, 'utf8');
    console.log('Successfully updated barsalController.js (CRLF)');
} else {
    console.error('Target not found in barsalController.js');
}
