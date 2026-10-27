
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\xps\Desktop\الحاج رفعت - نسخة العميل\الحاج رفعت\Start-AlHajjRefaat.exe")
$asm = [System.Reflection.Assembly]::Load($bytes)
Write-Output "EntryPoint: $($asm.EntryPoint.DeclaringType.FullName).$($asm.EntryPoint.Name)"
foreach ($type in $asm.GetTypes()) {
    Write-Output "Type: $($type.FullName)"
    foreach ($m in $type.GetMethods([System.Reflection.BindingFlags]'Public,NonPublic,Static,Instance')) {
        Write-Output "  Method: $($m.Name)"
    }
}
