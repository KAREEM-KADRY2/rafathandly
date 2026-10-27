$src = 'C:\Users\xps\Desktop\الحاج رفعت\الحاج رفعت'
$client = 'C:\Users\xps\Desktop\الحاج رفعت - نسخة العميل\الحاج رفعت'
$khas = 'C:\Users\xps\Desktop\خاص\الحاج رفعت'

Write-Host "Copying backend files..."
Copy-Item -Path "$src\backend\src\controllers\reportsV2Controller.js" -Destination "$client\backend\src\controllers\reportsV2Controller.js" -Force
Copy-Item -Path "$src\backend\src\controllers\reportsV2Controller.js" -Destination "$khas\backend\src\controllers\reportsV2Controller.js" -Force

Copy-Item -Path "$src\backend\src\routes\reportsV2.js" -Destination "$client\backend\src\routes\reportsV2.js" -Force
Copy-Item -Path "$src\backend\src\routes\reportsV2.js" -Destination "$khas\backend\src\routes\reportsV2.js" -Force

Write-Host "Copying frontend files..."
$feFiles = @(
  'src\components\reports\ReportSummary.jsx',
  'src\components\reports\PartnersTable.jsx',
  'src\pages\Reports.jsx',
  'src\pages\PartnershipDashboard.jsx'
)

foreach ($f in $feFiles) {
  $targetClient = Join-Path "$client\frontend" $f
  $targetKhas = Join-Path "$khas\frontend" $f
  New-Item -ItemType Directory -Force -Path (Split-Path $targetClient) | Out-Null
  New-Item -ItemType Directory -Force -Path (Split-Path $targetKhas) | Out-Null
  Copy-Item -Path (Join-Path "$src\frontend" $f) -Destination $targetClient -Force
  Copy-Item -Path (Join-Path "$src\frontend" $f) -Destination $targetKhas -Force
  Write-Host "Copied $f"
}
Write-Host "All files synchronized successfully."
