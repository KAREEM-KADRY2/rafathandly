
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\xps\Desktop\الحاج رفعت - نسخة العميل\الحاج رفعت\Start-AlHajjRefaat.exe")
$asm = [System.Reflection.Assembly]::Load($bytes)
$main = $asm.EntryPoint
$body = $main.GetMethodBody()
$il = $body.GetILAsByteArray()
Write-Output "IL byte count: $($il.Length)"

# Let's inspect string tokens used in Main
$module = $main.Module
Write-Output "Strings referenced:"
for ($offset = 0; $offset -lt $il.Length - 4; $offset++) {
    if ($il[$offset] -eq 0x72) { # ldstr opcode
        $token = [System.BitConverter]::ToInt32($il, $offset + 1)
        try {
            $str = $module.ResolveString($token)
            Write-Output "  ldstr: '$str'"
        } catch {}
    }
}
