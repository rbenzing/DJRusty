<#
.SYNOPSIS
    Analyzes project structure and outputs a summary.

.DESCRIPTION
    Scans the project directory to produce a summary including: directory tree,
    file counts by extension, detected frameworks/languages, and key config files.
    Excludes common non-source directories. Useful for onboarding to a codebase.

.PARAMETER Path
    Root directory to analyze. Defaults to the current directory.

.PARAMETER Depth
    Maximum directory depth for the tree view. Default: 3.

.PARAMETER TopExtensions
    Number of top file extensions to show. Default: 15.

.EXAMPLE
    .\Get-ProjectInfo.ps1

.EXAMPLE
    .\Get-ProjectInfo.ps1 -Path "C:\Projects\MyApp" -Depth 2
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Path = (Get-Location).Path,

    [int]$Depth = 3,

    [int]$TopExtensions = 15
)

$ErrorActionPreference = "Stop"

$ExcludeDirs = @('.git', 'node_modules', 'bin', 'obj', 'dist', 'build', 'vendor',
                  '__pycache__', '.vs', '.idea', 'packages', 'TestResults', '.next',
                  '.claude')

$ConfigFiles = @(
    @{ File = "package.json";       Label = "Node.js / npm" },
    @{ File = "tsconfig.json";      Label = "TypeScript" },
    @{ File = "*.csproj";           Label = ".NET Project" },
    @{ File = "*.sln";              Label = ".NET Solution" },
    @{ File = "Cargo.toml";         Label = "Rust / Cargo" },
    @{ File = "go.mod";             Label = "Go Module" },
    @{ File = "requirements.txt";   Label = "Python (pip)" },
    @{ File = "pyproject.toml";     Label = "Python (modern)" },
    @{ File = "Gemfile";            Label = "Ruby / Bundler" },
    @{ File = "docker-compose.yml"; Label = "Docker Compose" },
    @{ File = "Dockerfile";         Label = "Docker" },
    @{ File = ".github";            Label = "GitHub Actions/Config" },
    @{ File = "angular.json";       Label = "Angular" },
    @{ File = "next.config.*";      Label = "Next.js" },
    @{ File = "vite.config.*";      Label = "Vite" }
)

Write-Host "=== Project Summary ===" -ForegroundColor Cyan
Write-Host "Root: $Path"
Write-Host ""

# Detected frameworks
Write-Host "--- Detected Frameworks ---" -ForegroundColor Yellow
$detected = @()
foreach ($cfg in $ConfigFiles) {
    $found = Get-ChildItem -Path $Path -Filter $cfg.File -Depth 0 -ErrorAction SilentlyContinue
    if ($found) { $detected += $cfg.Label }
}
if ($detected.Count -gt 0) {
    $detected | ForEach-Object { Write-Host "  * $_" }
} else {
    Write-Host "  (none detected at root level)"
}
Write-Host ""

# File counts by extension
Write-Host "--- File Counts by Extension ---" -ForegroundColor Yellow
$allFiles = Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $fullPath = $_.FullName
        $skip = $false
        foreach ($dir in $ExcludeDirs) {
            if ($fullPath -match "[\\/]$([regex]::Escape($dir))[\\/]") { $skip = $true; break }
        }
        -not $skip
    }

$totalFiles = $allFiles.Count
$extGroups = $allFiles | Group-Object Extension | Sort-Object Count -Descending |
    Select-Object -First $TopExtensions

foreach ($g in $extGroups) {
    $ext = if ($g.Name) { $g.Name } else { "(no extension)" }
    $pct = [math]::Round(($g.Count / [math]::Max($totalFiles, 1)) * 100, 1)
    Write-Host ("  {0,-18} {1,5} files  ({2}%)" -f $ext, $g.Count, $pct)
}
Write-Host "  Total: $totalFiles files"
Write-Host ""

# Directory tree (limited depth)
Write-Host "--- Directory Tree (depth $Depth) ---" -ForegroundColor Yellow
function Show-Tree {
    param([string]$Dir, [int]$CurrentDepth, [int]$MaxDepth, [string]$Indent)
    if ($CurrentDepth -gt $MaxDepth) { return }
    $dirs = Get-ChildItem -Path $Dir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notin $ExcludeDirs } | Sort-Object Name
    foreach ($d in $dirs) {
        $fileCount = (Get-ChildItem -Path $d.FullName -File -ErrorAction SilentlyContinue).Count
        $suffix = if ($fileCount -gt 0) { " ($fileCount files)" } else { "" }
        Write-Host "${Indent}+-- $($d.Name)$suffix"
        Show-Tree -Dir $d.FullName -CurrentDepth ($CurrentDepth + 1) -MaxDepth $MaxDepth -Indent "$Indent|   "
    }
}
Show-Tree -Dir $Path -CurrentDepth 1 -MaxDepth $Depth -Indent "  "
Write-Host ""

# Key files at root
Write-Host "--- Key Root Files ---" -ForegroundColor Yellow
$rootFiles = Get-ChildItem -Path $Path -File -Depth 0 -ErrorAction SilentlyContinue |
    Sort-Object Name
foreach ($f in $rootFiles) {
    $size = if ($f.Length -gt 1024) { "{0:N0} KB" -f ($f.Length / 1024) } else { "$($f.Length) B" }
    Write-Host ("  {0,-30} {1}" -f $f.Name, $size)
}
Write-Host ""
Write-Host "=== End of Summary ===" -ForegroundColor Cyan

