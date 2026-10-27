
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\xps\Desktop\الحاج رفعت - نسخة العميل\الحاج رفعت\Start-AlHajjRefaat.exe")
$asm = [System.Reflection.Assembly]::Load($bytes)
$main = $asm.EntryPoint
$body = $main.GetMethodBody()
$il = $body.GetILAsByteArray()
$module = $main.Module

$token = [System.BitConverter]::ToInt32($il, 0x6B + 1)
$str = $module.ResolveString($token)
Write-Output "--- Embedded Start-System.bat in EXE ---"
Write-Output $str
