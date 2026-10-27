Add-Type -AssemblyName System.IO.Compression.FileSystem
$desktop = [Environment]::GetFolderPath('Desktop')
$src = Join-Path $desktop 'Al-Hajj-Refaat-Client'
$zipEn = Join-Path $desktop 'Al-Hajj-Refaat-Client.zip'
$zipAr = Join-Path $desktop 'الحاج رفعت.zip'

if (Test-Path $zipEn) { Remove-Item $zipEn -Force }
if (Test-Path $zipAr) { Remove-Item $zipAr -Force }

Write-Host "Creating archive from: $src ..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($src, $zipEn, [System.IO.Compression.CompressionLevel]::Fastest, $false)
Copy-Item $zipEn $zipAr -Force

Write-Host "ZIP created successfully at: $zipEn"
Write-Host "ZIP created successfully at: $zipAr"
Write-Host "File Size: $(([Math]::Round((Get-Item $zipEn).Length / 1MB, 2))) MB"

# Also copy to workspace root
$wsZip = "C:\Users\kareeem\OneDrive\Desktop\الحاج رفعت\Al-Hajj-Refaat-Client.zip"
Copy-Item $zipEn $wsZip -Force

