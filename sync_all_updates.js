const fs = require('fs');
const path = require('path');

const srcRoot = 'C:/Users/xps/Desktop/الحاج رفعت';
const targets = [
  'C:/Users/xps/Desktop/الحاج رفعت/الحاج رفعت',
  'C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت',
  'C:/Users/xps/Desktop/خاص/الحاج رفعت'
];

// 1. Copy frontend/dist to root dist
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// Copy built frontend/dist to c:/Users/xps/Desktop/الحاج رفعت/dist
const builtDist = path.join(srcRoot, 'frontend/dist');
const rootDist = path.join(srcRoot, 'dist');
console.log('Copying frontend/dist to root dist...');
copyDir(builtDist, rootDist);

// Files to sync to all targets
const filesToSync = [
  'backend/src/controllers/transportController.js',
  'backend/src/controllers/barsalController.js',
  'backend/src/routes/transports.js',
  'backend/src/routes/barsal.js',
  'frontend/src/pages/VehicleDetails.jsx',
  'frontend/src/pages/VehiclesList.jsx',
  'frontend/src/components/InlineTruckTripForm.jsx',
  'frontend/src/components/BarsalReport.jsx'
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    console.log(`Syncing to ${target}...`);
    // Sync dist
    copyDir(builtDist, path.join(target, 'dist'));
    if (fs.existsSync(path.join(target, 'frontend'))) {
      copyDir(builtDist, path.join(target, 'frontend/dist'));
    }

    // Sync files
    for (const f of filesToSync) {
      const srcFile = path.join(srcRoot, f);
      const destFile = path.join(target, f);
      if (fs.existsSync(srcFile)) {
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }
}

console.log('All targets successfully synchronized!');
