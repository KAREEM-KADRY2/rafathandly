const fs = require('fs');
const buf = fs.readFileSync('C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت/Create-Desktop-Shortcut.exe');
const str16 = buf.toString('utf16le');
const u16Matches = str16.match(/[\w.:\\/ -]{4,}/g) || [];
console.log(u16Matches.filter(s => s.includes('.lnk') || s.includes('.exe') || s.includes('Desktop') || s.includes('Start')));
