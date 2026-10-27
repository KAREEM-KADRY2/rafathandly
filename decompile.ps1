
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\xps\Desktop\الحاج رفعت - نسخة العميل\الحاج رفعت\Start-AlHajjRefaat.exe")
$asm = [System.Reflection.Assembly]::Load($bytes)
$main = $asm.EntryPoint
$body = $main.GetMethodBody()
$il = $body.GetILAsByteArray()
$module = $main.Module

for ($offset = 0; $offset -lt $il.Length; $offset++) {
    $op = $il[$offset]
    $str = ""
    if ($op -eq 0x72) {
        $token = [System.BitConverter]::ToInt32($il, $offset + 1)
        try { 
            $s = $module.ResolveString($token)
            if ($s.Length -gt 30) { $s = $s.Substring(0, 30) + "..." }
            $str = " ldstr: " + $s
        } catch {}
    }
    if ($op -eq 0x28 -or $op -eq 0x6F) {
        $token = [System.BitConverter]::ToInt32($il, $offset + 1)
        try { $str = " call: " + $module.ResolveMethod($token).DeclaringType.Name + "::" + $module.ResolveMethod($token).Name } catch {}
    }
    if ($str -ne "") {
        Write-Output ("{0:X4} : 0x{1:X2} {2}" -f $offset, $op, $str)
    }
}
