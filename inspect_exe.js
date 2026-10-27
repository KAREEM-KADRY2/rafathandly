const fs = require('fs');
const buf = fs.readFileSync('C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت/Start-AlHajjRefaat.exe');
// Find ASCII and UTF-16 strings
const asciiMatches = buf.toString('latin1').match(/[\w.:\\/ -]{5,}/g) || [];
console.log('--- Interesting ASCII strings in Start-AlHajjRefaat.exe ---');
console.log(asciiMatches.filter(s => s.includes('http') || s.includes('node') || s.includes('.js') || s.includes('cmd') || s.includes('5000') || s.includes('bat') || s.includes('vbs')));

// UTF-16 LE strings
const str16 = buf.toString('utf16le');
const u16Matches = str16.match(/[\w.:\\/ -]{5,}/g) || [];
console.log('--- Interesting UTF-16 strings ---');
console.log(u16Matches.filter(s => s.includes('http') || s.includes('node') || s.includes('.js') || s.includes('cmd') || s.includes('5000') || s.includes('bat') || s.includes('vbs')));
