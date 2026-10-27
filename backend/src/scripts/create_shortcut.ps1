$OutputEncoding = [System.Text.Encoding]::UTF8

$desktopPaths = @(
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
    (Join-Path $env:USERPROFILE 'Desktop')
)

$targetExe = 'C:\Al-Hajj-Refaat\Start-AlHajjRefaat.exe'
$workDir = 'C:\Al-Hajj-Refaat'

$sh = New-Object -ComObject WScript.Shell

foreach ($dir in $desktopPaths) {
    if (Test-Path $dir) {
        $shortcutNames = @('Al-Hajj-Refaat.lnk')
        foreach ($name in $shortcutNames) {
            try {
                $lnkPath = Join-Path $dir $name
                $sc = $sh.CreateShortcut($lnkPath)
                $sc.TargetPath = $targetExe
                $sc.WorkingDirectory = $workDir
                $sc.Description = "Al-Hajj Refaat Management System"
                $sc.Save()
                Write-Host "Created shortcut: $lnkPath"
            } catch {
                Write-Host "Failed to save: $lnkPath - $_"
            }
        }
    }
}
