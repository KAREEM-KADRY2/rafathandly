
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\xps\Desktop\الحاج رفعت - نسخة العميل\الحاج رفعت\Start-AlHajjRefaat.exe")
$asm = [System.Reflection.Assembly]::Load($bytes)
$main = $asm.EntryPoint
$body = $main.GetMethodBody()
$il = $body.GetILAsByteArray()
$module = $main.Module

for ($offset = 0; $offset -lt $il.Length - 4; $offset++) {
    if ($il[$offset] -eq 0x28 -or $il[$offset] -eq 0x6F) {
        $token = [System.BitConverter]::ToInt32($il, $offset + 1)
        try {
            $m = $module.ResolveMethod($token)
            if ($m.DeclaringType.FullName -like "*Process*") {
                Write-Output "$offset : Call $($m.DeclaringType.FullName)::$($m.Name)"
            }
        } catch {}
    }
}
