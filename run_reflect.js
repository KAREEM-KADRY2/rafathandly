const fs = require('fs');
const cp = require('child_process');

const script = `
$bytes = [System.IO.File]::ReadAllBytes("C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت\\Start-AlHajjRefaat.exe")
$asm = [System.Reflection.Assembly]::Load($bytes)
Write-Output "EntryPoint: $($asm.EntryPoint.DeclaringType.FullName).$($asm.EntryPoint.Name)"
foreach ($type in $asm.GetTypes()) {
    Write-Output "Type: $($type.FullName)"
    foreach ($m in $type.GetMethods([System.Reflection.BindingFlags]'Public,NonPublic,Static,Instance')) {
        Write-Output "  Method: $($m.Name)"
    }
}
`;
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync('reflect.ps1', Buffer.concat([bom, Buffer.from(script, 'utf8')]));
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File reflect.ps1').toString();
console.log(out);
