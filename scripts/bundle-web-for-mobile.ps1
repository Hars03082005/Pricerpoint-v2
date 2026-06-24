# Copies the Vite dist output into the Flutter mobile assets folder.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dist = Join-Path $root 'dist'
$dest = Join-Path $root 'mobile/assets/web'

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
  Write-Error "dist/ not found. Run 'npm run build' first."
}

if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Recurse -Force (Join-Path $dist '*') $dest
Write-Host "Web build copied to mobile/assets/web"
