const fs = require('fs');
const path = require('path');

function printTree(dir, depth = 0) {
    if (depth > 3) return;
    try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
            const full = path.join(dir, f);
            const isDir = fs.statSync(full).isDirectory();
            console.log(' '.repeat(depth * 2) + (isDir ? '[D] ' : '[F] ') + f);
            if (isDir) printTree(full, depth + 1);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

console.log('=== Inside: Ø§Ù„Ø­Ø§Ø¬ Ø±Ù Ø¹Øª - Ù†Ø³Ø®Ø© Ø§Ù„Ø¹Ù…ÙŠÙ„ ===');
printTree('C:/Users/xps/Desktop/Ø§Ù„Ø­Ø§Ø¬ Ø±Ù Ø¹Øª - Ù†Ø³Ø®Ø© Ø§Ù„Ø¹Ù…ÙŠÙ„');

console.log('\n=== Inside: الحاج رفعت - نسخة العميل ===');
printTree('C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل');
