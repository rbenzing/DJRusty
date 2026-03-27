<#
.SYNOPSIS
    Shows a quick status dashboard of all artifact phases for a project.

.DESCRIPTION
    Displays a compact overview of which phases have artifacts present,
    how many are found vs expected, and the overall project progress.

.PARAMETER ProjectName
    The project identifier (e.g., "user-auth").

.PARAMETER Root
    Repository root directory. Defaults to current directory.

.EXAMPLE
    .\Get-ArtifactStatus.ps1 -ProjectName "user-auth"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ProjectName,

    [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$base = Join-Path $Root "orchestration" "artifacts"

$phases = [ordered]@{
    "research"     = @("proposal.md","requirements.md","technical-constraints.md","specs/scenarios.md")
    "architecture" = @("architecture.md")
    "ui-design"    = @("ui-spec.md","design-system.md","accessibility.md")
    "planning"     = @("design.md","implementation-spec.md","story-breakdown.md")
    "development"  = @("implementation-notes.md","build-logs.txt")
    "reviews"      = @("code-review-report.md")
    "testing"      = @("test-results.md","test-coverage.md")
}

Write-Host "`nProject: $ProjectName" -ForegroundColor White
Write-Host ("{0}" -f ([char]0x2500 * 30)) -ForegroundColor DarkGray

$totalFound = 0
$totalExpected = 0

foreach ($phase in $phases.Keys) {
    $phaseDir = Join-Path $base $phase $ProjectName
    $files = $phases[$phase]
    $total = $files.Count
    $totalExpected += $total

    $found = 0
    foreach ($file in $files) {
        if (Test-Path (Join-Path $phaseDir $file)) { $found++ }
    }
    $totalFound += $found

    $padded = $phase.PadRight(15)
    if (-not (Test-Path $phaseDir)) {
        Write-Host "  ${padded}" -NoNewline -ForegroundColor White
        Write-Host "$([char]0x2014) not started" -ForegroundColor DarkGray
    } elseif ($found -eq $total) {
        Write-Host "  ${padded}" -NoNewline -ForegroundColor White
        Write-Host "$([char]0x2705) $found/$total artifacts" -ForegroundColor Green
    } elseif ($found -gt 0) {
        Write-Host "  ${padded}" -NoNewline -ForegroundColor White
        Write-Host "$([char]0x26A0) $found/$total artifacts" -ForegroundColor Yellow
    } else {
        Write-Host "  ${padded}" -NoNewline -ForegroundColor White
        Write-Host "$([char]0x274C) 0/$total artifacts" -ForegroundColor Red
    }
}

Write-Host ("{0}" -f ([char]0x2500 * 30)) -ForegroundColor DarkGray
$pct = if ($totalExpected -gt 0) { [math]::Round(($totalFound / $totalExpected) * 100) } else { 0 }
Write-Host "  Overall: $totalFound/$totalExpected ($pct%)" -ForegroundColor White

