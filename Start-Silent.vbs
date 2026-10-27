Dim WshShell, baseDir, fso
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = baseDir
WshShell.Run "cmd /c ""cd /d " & Chr(34) & baseDir & Chr(34) & " && Start-System.bat""", 0, False
Set WshShell = Nothing
Set fso = Nothing
