# PowerShell script to reliably create Al-Hajj Refaat System desktop shortcut
$ErrorActionPreference = 'Stop'

# 1. Determine dynamic Windows Desktop path
$desktopPath = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktopPath) -or -not (Test-Path $desktopPath)) {
    $userProfile = $env:USERPROFILE
    if (Test-Path (Join-Path $userProfile 'OneDrive\Desktop')) {
        $desktopPath = Join-Path $userProfile 'OneDrive\Desktop'
    } elseif (Test-Path (Join-Path $userProfile 'Desktop')) {
        $desktopPath = Join-Path $userProfile 'Desktop'
    } else {
        $desktopPath = Join-Path $userProfile 'Desktop'
        New-Item -ItemType Directory -Path $desktopPath -Force | Out-Null
    }
}

Write-Host "Resolved Dynamic Desktop Path: $desktopPath"

# 2. Define Target Executable & Working Directory
$targetDir = 'C:\Al-Hajj-Refaat'
if (-not (Test-Path $targetDir)) {
    $targetDir = Join-Path $env:USERPROFILE 'OneDrive\Desktop\Al-Hajj-Refaat-Client'
}

$targetExe = Join-Path $targetDir 'Start-AlHajjRefaat.exe'
if (-not (Test-Path $targetExe)) {
    $targetExe = Join-Path $targetDir 'Start-System.bat'
}

Write-Host "Target Executable: $targetExe"
Write-Host "Working Directory: $targetDir"

if (-not (Test-Path $targetExe)) {
    Write-Error "Target executable does not exist at: $targetExe"
    exit 1
}

# 3. Create Desktop Shortcut using WScript.Shell COM Object
$shortcutName = "Al-Hajj Refaat System.lnk"
$shortcutPath = Join-Path $desktopPath $shortcutName

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = $targetExe
$sc.WorkingDirectory = $targetDir
$sc.Description = "Al-Hajj Refaat System"
if (Test-Path $targetExe) {
    $sc.IconLocation = "$targetExe,0"
}
$sc.Save()

# 4. Verify Shortcut Creation and Target Linkage
if (Test-Path $shortcutPath) {
    Write-Host "SUCCESS: Shortcut created at: $shortcutPath"
    
    # Read back properties for confirmation
    $verifySc = $wsh.CreateShortcut($shortcutPath)
    Write-Host "  Shortcut Target:           $($verifySc.TargetPath)"
    Write-Host "  Shortcut WorkingDirectory: $($verifySc.WorkingDirectory)"
    Write-Host "  Target Exists?             $(Test-Path $($verifySc.TargetPath))"
} else {
    Write-Error "FAILED to verify shortcut creation at: $shortcutPath"
    exit 1
}
