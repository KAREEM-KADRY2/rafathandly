const fs = require('fs');
// Let's use adm-zip or just check with powershell or archiver
const cp = require('child_process');
const cmd = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل.zip")
$names = $zip.Entries | ForEach-Object { $_.FullName }
$zip.Dispose()

Write-Output "Total entries: $($names.Count)"
$checkList = @(
    "الحاج رفعت/Start-AlHajjRefaat.exe",
    "الحاج رفعت/runtime/node.exe",
    "الحاج رفعت/backend/node.exe",
    "الحاج رفعت/index.js",
    "الحاج رفعت/backend/index.js",
    "الحاج رفعت/backend/src/db/database.sqlite",
    "الحاج رفعت/backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
    "الحاج رفعت/dist/index.html",
    "الحاج رفعت/frontend/dist/index.html",
    "الحاج رفعت/تشغيل_النظام.bat"
)
foreach ($c in $checkList) {
    $exists = $names -contains $c
    Write-Output "$c : $exists"
}
`;
fs.writeFileSync('check_zip_contents.ps1', cmd, 'utf8');
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File check_zip_contents.ps1').toString();
console.log(out);
