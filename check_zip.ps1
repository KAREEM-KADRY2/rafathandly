
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = (Get-Item "C:\Users\xps\Desktop\*نسخة*.zip").FullName
Write-Output "Zip Path: $zipPath"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
Write-Output "Total entries: $($zip.Entries.Count)"

$patterns = @("node.exe", "Start-", "Stop-", "Create-", "index.js", "database.sqlite", "dist", "bat")
foreach ($pat in $patterns) {
    Write-Output "--- Pattern: $pat ---"
    $zip.Entries | Where-Object { $_.FullName -like "*$pat*" } | Select-Object -First 5 FullName | ForEach-Object { $_.FullName }
}
$zip.Dispose()
