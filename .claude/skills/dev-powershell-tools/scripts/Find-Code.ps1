<#
.SYNOPSIS
    Searches project files for a regex pattern, respecting .gitignore exclusions.

.DESCRIPTION
    Recursively searches files in the project directory for lines matching a
    regular expression. Automatically excludes common non-source directories
    (node_modules, .git, bin, obj, dist, vendor, __pycache__) and binary files.
    If git is available, uses git ls-files for accurate .gitignore support.

.PARAMETER Pattern
    The regex pattern to search for (case-insensitive by default).

.PARAMETER Path
    Root directory to search. Defaults to the current directory.

.PARAMETER Include
    File glob filter (e.g., "*.ts", "*.cs"). Defaults to all text files.

.PARAMETER Context
    Number of lines of context to show before and after each match. Default: 0.

.PARAMETER CaseSensitive
    Enable case-sensitive matching.

.PARAMETER MaxResults
    Maximum number of matches to return. Default: 100.

.EXAMPLE
    .\Find-Code.ps1 -Pattern "TODO|FIXME"

.EXAMPLE
    .\Find-Code.ps1 -Pattern "class\s+\w+Controller" -Include "*.cs" -Context 2

.EXAMPLE
    .\Find-Code.ps1 -Pattern "import.*from" -Include "*.ts" -MaxResults 50
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Pattern,

    [Parameter(Position = 1)]
    [string]$Path = (Get-Location).Path,

    [string]$Include = "*",

    [int]$Context = 0,

    [switch]$CaseSensitive,

    [int]$MaxResults = 100
)

$ErrorActionPreference = "Stop"

$ExcludeDirs = @('.git', 'node_modules', 'bin', 'obj', 'dist', 'build', 'vendor',
                  '__pycache__', '.vs', '.idea', 'packages', 'TestResults', '.next')

$BinaryExtensions = @('.exe', '.dll', '.pdb', '.zip', '.tar', '.gz', '.png',
                       '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf',
                       '.mp3', '.mp4', '.pdf', '.nupkg', '.snk')

$matchCount = 0
$regexOptions = if ($CaseSensitive) { [System.Text.RegularExpressions.RegexOptions]::None }
                else { [System.Text.RegularExpressions.RegexOptions]::IgnoreCase }

# Try git ls-files first for accurate .gitignore support
$files = @()
$useGit = $false
try {
    Push-Location $Path
    $gitFiles = git ls-files --cached --others --exclude-standard 2>$null
    if ($LASTEXITCODE -eq 0 -and $gitFiles) {
        $files = $gitFiles | Where-Object {
            $name = Split-Path $_ -Leaf
            if ($Include -ne "*") { $name -like $Include } else { $true }
        } | Where-Object {
            $ext = [System.IO.Path]::GetExtension($_)
            $ext -notin $BinaryExtensions
        } | ForEach-Object { Join-Path $Path $_ }
        $useGit = $true
    }
} catch { } finally { Pop-Location }

# Fallback: manual file enumeration
if (-not $useGit) {
    Write-Host "Note: git not available, using manual file search" -ForegroundColor Yellow
    $files = Get-ChildItem -Path $Path -Recurse -File -Filter $Include -ErrorAction SilentlyContinue |
        Where-Object {
            $fullPath = $_.FullName
            $skip = $false
            foreach ($dir in $ExcludeDirs) {
                if ($fullPath -match "[\\/]$([regex]::Escape($dir))[\\/]") { $skip = $true; break }
            }
            $ext = $_.Extension
            -not $skip -and ($ext -notin $BinaryExtensions)
        } | Select-Object -ExpandProperty FullName
}

foreach ($file in $files) {
    if ($matchCount -ge $MaxResults) {
        Write-Host "`n--- Stopped at $MaxResults matches (use -MaxResults to increase) ---"
        break
    }
    if (-not (Test-Path $file)) { continue }
    try {
        $lines = [System.IO.File]::ReadAllLines($file)
    } catch { continue }

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ([regex]::IsMatch($lines[$i], $Pattern, $regexOptions)) {
            $matchCount++
            if ($matchCount -gt $MaxResults) { break }

            $relPath = $file
            if ($file.StartsWith($Path)) {
                $relPath = $file.Substring($Path.Length).TrimStart('\', '/')
            }

            $lineNum = $i + 1
            Write-Host "${relPath}:${lineNum}: $($lines[$i].TrimEnd())" -ForegroundColor Cyan

            if ($Context -gt 0) {
                $start = [Math]::Max(0, $i - $Context)
                $end = [Math]::Min($lines.Count - 1, $i + $Context)
                for ($j = $start; $j -le $end; $j++) {
                    if ($j -ne $i) {
                        $ctxNum = $j + 1
                        Write-Host "  ${relPath}:${ctxNum}: $($lines[$j].TrimEnd())" -ForegroundColor DarkGray
                    }
                }
                Write-Host ""
            }
        }
    }
}

Write-Host "`nTotal matches: $matchCount" -ForegroundColor Green

