const fs = require('fs');
const path = require('path');

const builtDist = 'C:\\Users\\xps\\Desktop\\خاص\\الحاج رفعت\\frontend\\dist';

const targets = [
  'C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت\\dist',
  'C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت\\frontend\\dist',
  'C:\\Users\\xps\\Desktop\\الحاج رفعت\\الحاج رفعت\\dist',
  'C:\\Users\\xps\\Desktop\\الحاج رفعت\\الحاج رفعت\\frontend\\dist',
  'C:\\Users\\xps\\Desktop\\الحاج رفعت\\dist',
  'C:\\Users\\xps\\Desktop\\الحاج رفعت\\frontend\\dist',
  'C:\\Users\\xps\\Desktop\\خاص\\الحاج رفعت\\dist'
];

function copyFolderRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursive(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

for (const t of targets) {
  try {
    copyFolderRecursive(builtDist, t);
    console.log(`Copied dist to: ${t}`);
  } catch (err) {
    console.error(`Error copying to ${t}:`, err.message);
  }
}
console.log('Dist distribution complete.');
