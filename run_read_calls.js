const fs = require('fs');
const cp = require('child_process');

const script = `
$bytes = [System.IO.File]::ReadAllBytes("C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت\\Start-AlHajjRefaat.exe")
$asm = [System.Reflection.Assembly]::Load($bytes)
$main = $asm.EntryPoint
$body = $main.GetMethodBody()
$il = $body.GetILAsByteArray()
$module = $main.Module

Write-Output "Calls referenced:"
for ($offset = 0; $offset -lt $il.Length - 4; $offset++) {
    if ($il[$offset] -eq 0x28 -or $il[$offset] -eq 0x6F) { # call or callvirt
        $token = [System.BitConverter]::ToInt32($il, $offset + 1)
        try {
            $m = $module.ResolveMethod($token)
            Write-Output "  Call: $($m.DeclaringType.FullName)::$($m.Name)"
        } catch {}
    }
}
`;
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync('read_calls.ps1', Buffer.concat([bom, Buffer.from(script, 'utf8')]));
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File read_calls.ps1').toString();
console.log(out);
