
$sh = New-Object -ComObject WScript.Shell
$sc = $sh.CreateShortcut("C:\Users\xps\Desktop\Alhaj-Refaat-System.lnk")
[PSCustomObject]@{
    TargetPath = $sc.TargetPath
    WorkingDirectory = $sc.WorkingDirectory
    Arguments = $sc.Arguments
} | Format-List
