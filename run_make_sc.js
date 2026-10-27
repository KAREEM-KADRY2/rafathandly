const cp = require('child_process');

const script = `
$sh = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')

# Update Alhaj-Refaat-System.lnk
$sc1 = $sh.CreateShortcut("$desktop\\Alhaj-Refaat-System.lnk")
$target = "C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت\\Start-AlHajjRefaat.exe"
$sc1.TargetPath = $target
$sc1.WorkingDirectory = "C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت"
$sc1.IconLocation = "$target,0"
$sc1.Description = "نظام الحاج رفعت لإدارة الحسابات"
$sc1.Save()

# Also create Arabic named shortcut
$sc2 = $sh.CreateShortcut("$desktop\\نظام الحاج رفعت.lnk")
$sc2.TargetPath = $target
$sc2.WorkingDirectory = "C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت"
$sc2.IconLocation = "$target,0"
$sc2.Description = "نظام الحاج رفعت لإدارة الحسابات"
$sc2.Save()

Write-Output "Shortcuts successfully created!"
`;

const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
require('fs').writeFileSync('make_desktop_sc.ps1', Buffer.concat([bom, Buffer.from(script, 'utf8')]));
const out = cp.execSync('powershell -ExecutionPolicy Bypass -File make_desktop_sc.ps1').toString();
console.log(out);
