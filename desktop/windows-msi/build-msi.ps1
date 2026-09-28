param(
  [string]$OutputName = "FiscalBox-Knjigovodja-Setup.msi"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $Root "..\..")
$Dist = Join-Path $Root "dist"
$PublicDownloads = Join-Path $ProjectRoot "public\downloads"

if (-not (Get-Command wix -ErrorAction SilentlyContinue)) {
  throw "WiX Toolset CLI nije pronađen. Instalirajte WiX Toolset 4+ i proverite da komanda 'wix' radi u PowerShell-u."
}

New-Item -ItemType Directory -Force -Path $Dist | Out-Null
New-Item -ItemType Directory -Force -Path $PublicDownloads | Out-Null

Push-Location $Root
try {
  # WixUI_InstallDir se nalazi u WixToolset.UI.wixext ekstenziji.
  wix build Product.wxs `
    -ext WixToolset.UI.wixext `
    -arch x64 `
    -o (Join-Path $Dist $OutputName)
} finally {
  Pop-Location
}

Copy-Item (Join-Path $Dist $OutputName) (Join-Path $PublicDownloads $OutputName) -Force

Write-Host ""
Write-Host "MSI napravljen:" -ForegroundColor Green
Write-Host (Join-Path $Dist $OutputName)
Write-Host "Kopiran u web download folder:" -ForegroundColor Green
Write-Host (Join-Path $PublicDownloads $OutputName)
Write-Host ""
Write-Host "PRE OBJAVE: digitalno potpisati MSI code-signing sertifikatom." -ForegroundColor Yellow
