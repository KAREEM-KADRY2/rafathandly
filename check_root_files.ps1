
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("C:\Users\xps\Desktop\الحاج رفعت - نسخة العميل.zip")
$match = $zip.Entries | Where-Object { $_.FullName -eq "الحاج رفعت/index.js" }
Write-Output "Found index.js in root: $($match.FullName)"
$allRoots = $zip.Entries | Where-Object { $_.FullName -match "^الحاج رفعت/[^/]+$" } | ForEach-Object { $_.FullName }
Write-Output "All root files in zip:"
$allRoots
$zip.Dispose()
