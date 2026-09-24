@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "APP_URL=https://fiscalbox.rs/login"
set "APP_DIR=%LOCALAPPDATA%\FiscalBoxKnjigovodja"
set "ICON_URL=https://fiscalbox.rs/icons/fiscalbox.ico"
set "ICON_FILE=%APP_DIR%\FiscalBox.ico"

if not exist "%APP_DIR%" mkdir "%APP_DIR%" >nul 2>&1

echo FiscalBox KNJIGO - Windows instalacija
echo ---------------------------------------
echo Pripremam aplikaciju...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "$edge=@($env:ProgramFiles+'\Microsoft\Edge\Application\msedge.exe',${env:ProgramFiles(x86)}+'\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
 "$chrome=@($env:ProgramFiles+'\Google\Chrome\Application\chrome.exe',${env:ProgramFiles(x86)}+'\Google\Chrome\Application\chrome.exe',$env:LOCALAPPDATA+'\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
 "$browser=if($edge){$edge}else{$chrome}; if(-not $browser){throw 'Microsoft Edge ili Google Chrome nije pronađen.'};" ^
 "try { Invoke-WebRequest -UseBasicParsing '%ICON_URL%' -OutFile '%ICON_FILE%' -TimeoutSec 15 } catch {};" ^
 "$w=New-Object -ComObject WScript.Shell;" ^
 "$desktop=[Environment]::GetFolderPath('Desktop');" ^
 "$start=[Environment]::GetFolderPath('Programs');" ^
 "$targets=@((Join-Path $desktop 'FiscalBox KNJIGO.lnk'),(Join-Path $start 'FiscalBox KNJIGO.lnk'));" ^
 "foreach($lnk in $targets){$s=$w.CreateShortcut($lnk);$s.TargetPath=$browser;$s.Arguments='--app=%APP_URL% --start-maximized';$s.WorkingDirectory=Split-Path $browser;$s.Description='FiscalBox KNJIGO';if(Test-Path '%ICON_FILE%'){$s.IconLocation='%ICON_FILE%'}else{$s.IconLocation=$browser+',0'};$s.Save()};" ^
 "Start-Process $browser -ArgumentList '--app=%APP_URL% --start-maximized';"

if errorlevel 1 (
  echo.
  echo Instalacija nije uspela. Proverite da li imate Microsoft Edge ili Google Chrome.
  pause
  exit /b 1
)

echo.
echo FiscalBox KNJIGO je instaliran.
echo Precica je dodata na Desktop i u Start meni.
timeout /t 4 >nul
exit /b 0
