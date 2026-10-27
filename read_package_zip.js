const fs = require('fs');
if (fs.existsSync('C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت/package_client_zip.js')) {
    console.log(fs.readFileSync('C:/Users/xps/Desktop/الحاج رفعت - نسخة العميل/الحاج رفعت/package_client_zip.js', 'utf8'));
} else {
    console.log('Not found in client folder');
}
