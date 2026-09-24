@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop');$s=[Environment]::GetFolderPath('Programs');Remove-Item (Join-Path $d 'FiscalBox KNJIGO.lnk') -Force -ErrorAction SilentlyContinue;Remove-Item (Join-Path $s 'FiscalBox KNJIGO.lnk') -Force -ErrorAction SilentlyContinue;Remove-Item (Join-Path $env:LOCALAPPDATA 'FiscalBoxKnjigovodja') -Recurse -Force -ErrorAction SilentlyContinue"
echo FiscalBox KNJIGO precice su uklonjene.
timeout /t 3 >nul
