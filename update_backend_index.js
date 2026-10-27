const fs = require('fs');

const targetDirs = [
    'C:/Users/xps/Desktop/الحاج رفعت/الحاج رفعت/backend/index.js',
    'C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت/backend/index.js',
    'C:/Users/xps/Desktop/خاص/الحاج رفعت/backend/index.js'
];

for (const p of targetDirs) {
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf8');
        const oldCode = `const PORT = process.env.PORT || 5000;\napp.listen(PORT, () => {\n    console.log(\`Server running on port \${PORT}\`);\n});`;
        const oldCodeCRLF = `const PORT = process.env.PORT || 5000;\r\napp.listen(PORT, () => {\r\n    console.log(\`Server running on port \${PORT}\`);\r\n});`;
        
        const newCode = `const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
    if (process.env.OPEN_BROWSER === 'true') {
        try {
            const { exec } = require('child_process');
            exec('start http://127.0.0.1:5000');
        } catch (e) {
            console.error('Failed to open browser:', e);
        }
    }
});`;

        if (content.includes(oldCode)) {
            content = content.replace(oldCode, newCode);
            fs.writeFileSync(p, content, 'utf8');
            console.log('Updated LF:', p);
        } else if (content.includes(oldCodeCRLF)) {
            content = content.replace(oldCodeCRLF, newCode.replace(/\n/g, '\r\n'));
            fs.writeFileSync(p, content, 'utf8');
            console.log('Updated CRLF:', p);
        } else {
            console.log('Target pattern not found in:', p);
        }
    } else {
        console.log('File does not exist:', p);
    }
}
