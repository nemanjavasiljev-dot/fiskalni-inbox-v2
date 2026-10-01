Option Explicit

Dim shell, fso, edge1, edge2, chrome1, chrome2, chrome3, browser, appUrl, args
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appUrl = "https://fiscalbox.rs/desktop/knjigovodja?source=msi"
edge1 = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"
edge2 = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
chrome1 = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
chrome2 = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe"
chrome3 = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"

browser = ""
If fso.FileExists(edge1) Then
  browser = edge1
ElseIf fso.FileExists(edge2) Then
  browser = edge2
ElseIf fso.FileExists(chrome1) Then
  browser = chrome1
ElseIf fso.FileExists(chrome2) Then
  browser = chrome2
ElseIf fso.FileExists(chrome3) Then
  browser = chrome3
End If

If browser <> "" Then
  args = Chr(34) & browser & Chr(34) & " --app=" & Chr(34) & appUrl & Chr(34) & " --start-maximized"
  shell.Run args, 1, False
Else
  ' Rezerva: otvori u podrazumevanom browseru ako Edge/Chrome nisu pronađeni.
  shell.Run appUrl, 1, False
End If
