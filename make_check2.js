const fs = require('fs');
const content = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل.zip")
$match = $zip.Entries | Where-Object { $_.FullName -eq "الحاج رفعت/index.js" }
Write-Output "Found index.js in root: $($match.FullName)"
$allRoots = $zip.Entries | Where-Object { $_.FullName -match "^الحاج رفعت/[^/]+$" } | ForEach-Object { $_.FullName }
Write-Output "All root files in zip:"
$allRoots
$zip.Dispose()
`;
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync('check_root_files.ps1', Buffer.concat([bom, Buffer.from(content, 'utf8')]));
