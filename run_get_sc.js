const fs = require('fs');
const cp = require('child_process');

const script = `
$sh = New-Object -ComObject WScript.Shell
$sc = $sh.CreateShortcut("C:\\Users\\xps\\Desktop\\Alhaj-Refaat-System.lnk")
[PSCustomObject]@{
    TargetPath = $sc.TargetPath
    WorkingDirectory = $sc.WorkingDirectory
    Arguments = $sc.Arguments
} | Format-List
`;
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync('get_sc.ps1', Buffer.concat([bom, Buffer.from(script, 'utf8')]));
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File get_sc.ps1').toString();
console.log(out);
