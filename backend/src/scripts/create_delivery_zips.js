const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopDir = path.resolve(process.env.USERPROFILE || 'C:\\Users\\kareeem', 'OneDrive\\Desktop');
const srcDir = path.join(desktopDir, 'Al-Hajj-Refaat-Client');

const zipEn = path.join(desktopDir, 'Al-Hajj-Refaat-Client.zip');
const zipAr = path.join(desktopDir, 'الحاج رفعت.zip');
const wsZip = path.resolve(__dirname, '../../../Al-Hajj-Refaat-Client.zip');

console.log('=== CREATING CLIENT DELIVERY ZIP PACKAGES ===');
console.log('Source Directory:', srcDir);

if (!fs.existsSync(srcDir)) {
    console.error('Source directory does not exist:', srcDir);
    process.exit(1);
}

// Remove old zips
[zipEn, zipAr, wsZip].forEach(z => {
    if (fs.existsSync(z)) {
        fs.unlinkSync(z);
        console.log('Removed old zip:', z);
    }
});

console.log('Compressing to ZIP (this may take a few moments)...');

// Execute powershell ZipFile compression with arguments (avoiding encoding issues in ps1 scripts)
const psCmd = `& {
    param($src, $dst)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst, [System.IO.Compression.CompressionLevel]::Fastest, $false)
}`;

try {
    execFileSync('powershell', ['-NoProfile', '-Command', psCmd, srcDir, zipEn], { stdio: 'inherit' });
    console.log('Main zip created:', zipEn);

    // Copy to Arabic named zip
    fs.copyFileSync(zipEn, zipAr);
    console.log('Arabic zip created:', zipAr);

    // Copy to workspace
    fs.copyFileSync(zipEn, wsZip);
    console.log('Workspace zip created:', wsZip);

    const stats = fs.statSync(zipEn);
    console.log(`\nSuccess! ZIP file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
} catch (e) {
    console.error('Error creating zip:', e);
    process.exit(1);
}
