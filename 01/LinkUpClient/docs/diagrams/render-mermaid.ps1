# Requires: Node.js and mermaid-cli installed (global or via npx)
# Usage:
#   - Global:   mermaid .\*.mmd -o .\out -e png
#   - With npx: .\render-mermaid.ps1

param(
  [string]$Ext = "png"  # png | svg | pdf
)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path "$here\out")) { New-Item -ItemType Directory -Path "$here\out" | Out-Null }

$files = @(Get-ChildItem -Filter *.mmd | Select-Object -ExpandProperty FullName)
if ($files.Count -eq 0) {
  Write-Host "No .mmd files found in $here"
  exit 1
}

function Try-Run($cmd, $args) {
  try {
    & $cmd @args
    return $true
  } catch {
    return $false
  }
}

# Prefer npx (no global install needed)
$args = @("-y", "@mermaid-js/mermaid-cli", "-o", "out", "-e", $Ext) + $files
if (Try-Run "npx" $args) { exit 0 }

# Fallback to global mermaid
$args2 = @("-o", "out", "-e", $Ext) + $files
if (Try-Run "mmdc" $args2) { exit 0 }

Write-Host "Could not run mermaid-cli. Please install Node and try: npm i -g @mermaid-js/mermaid-cli"
exit 2

