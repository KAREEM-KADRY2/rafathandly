
Set-Location "C:\Users\xps\Desktop\الحاج رفعت - نسخة العميل\الحاج رفعت"
Start-Process ".\Start-AlHajjRefaat.exe"
for ($i = 1; $i -le 10; $i++) {
    $p = Get-Process node -ErrorAction SilentlyContinue
    if ($p) {
        $pids = ($p | ForEach-Object { $_.Id }) -join ","
        Write-Output "Second $i : Node is running (PIDs: $pids)"
    } else {
        Write-Output "Second $i : Node is NOT running"
    }
    Start-Sleep -Seconds 1
}
