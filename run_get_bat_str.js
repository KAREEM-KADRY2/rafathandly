const fs = require('fs');
const cp = require('child_process');

const script = `
$bytes = [System.IO.File]::ReadAllBytes("C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت\\Start-AlHajjRefaat.exe")
$asm = [System.Reflection.Assembly]::Load($bytes)
$main = $asm.EntryPoint
$body = $main.GetMethodBody()
$il = $body.GetILAsByteArray()
$module = $main.Module

$token = [System.BitConverter]::ToInt32($il, 0x6B + 1)
$str = $module.ResolveString($token)
Write-Output "--- Embedded Start-System.bat in EXE ---"
Write-Output $str
`;
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync('get_bat_str.ps1', Buffer.concat([bom, Buffer.from(script, 'utf8')]));
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File get_bat_str.ps1').toString();
console.log(out);
