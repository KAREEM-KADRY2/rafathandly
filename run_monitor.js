const fs = require('fs');
const cp = require('child_process');

const script = `
Set-Location "C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت"
Start-Process ".\\Start-AlHajjRefaat.exe"
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
`;
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync('monitor_run.ps1', Buffer.concat([bom, Buffer.from(script, 'utf8')]));
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File monitor_run.ps1').toString();
console.log(out);
