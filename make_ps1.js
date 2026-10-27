const fs = require('fs');
const content = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = (Get-Item "C:\\Users\\xps\\Desktop\\*نسخة*.zip").FullName
Write-Output "Zip Path: $zipPath"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
Write-Output "Total entries: $($zip.Entries.Count)"

$patterns = @("node.exe", "Start-", "Stop-", "Create-", "index.js", "database.sqlite", "dist", "bat")
foreach ($pat in $patterns) {
    Write-Output "--- Pattern: $pat ---"
    $zip.Entries | Where-Object { $_.FullName -like "*$pat*" } | Select-Object -First 5 FullName | ForEach-Object { $_.FullName }
}
$zip.Dispose()
`;
// Write with UTF-8 BOM so PowerShell 5.1 reads it properly
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync('check_zip.ps1', Buffer.concat([bom, Buffer.from(content, 'utf8')]));
