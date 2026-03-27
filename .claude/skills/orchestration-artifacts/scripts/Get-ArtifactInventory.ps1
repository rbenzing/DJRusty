<#
.SYNOPSIS
    Lists expected and existing artifacts for a project, showing completeness per phase.

.DESCRIPTION
    Checks the orchestration artifact directory for a project and reports which
    files exist and which are missing for each phase.

.PARAMETER ProjectName
    The project identifier (e.g., "user-auth").

.PARAMETER Phase
    Optional. Check only a specific phase (research, architecture, ui-design,
    planning, development, reviews, testing). Default: all phases.

.PARAMETER Root
    Repository root directory. Defaults to current directory.

.EXAMPLE
    .\Get-ArtifactInventory.ps1 -ProjectName "user-auth"

.EXAMPLE
    .\Get-ArtifactInventory.ps1 -ProjectName "user-auth" -Phase "research"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ProjectName,

    [ValidateSet("all", "research", "architecture", "ui-design", "planning",
                 "development", "reviews", "testing")]
    [string]$Phase = "all",

    [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$base = Join-Path $Root "orchestration" "artifacts"

$phases = [ordered]@{
    "research"     = @("proposal.md", "requirements.md", "technical-constraints.md",
                       "specs/scenarios.md", "specs/spec-before.md")
    "architecture" = @("architecture.md", "decisions/")
    "ui-design"    = @("ui-spec.md", "design-system.md", "accessibility.md",
                       "migration-map.md", "flows/")
    "planning"     = @("design.md", "implementation-spec.md", "story-breakdown.md",
                       "spec-after.md")
    "development"  = @("implementation-notes.md", "build-logs.txt")
    "reviews"      = @("code-review-report.md", "feedback.md")
    "testing"      = @("test-results.md", "bug-reports.md", "test-coverage.md")
}

$phasesToCheck = if ($Phase -eq "all") { $phases.Keys } else { @($Phase) }

Write-Host "`nProject: $ProjectName" -ForegroundColor White
Write-Host ("{0}" -f ("-" * 40)) -ForegroundColor DarkGray

$totalExpected = 0
$totalFound = 0

foreach ($p in $phasesToCheck) {
    $phaseDir = Join-Path $base $p $ProjectName
    $files = $phases[$p]

    $found = 0
    $missing = @()
    $present = @()

    foreach ($file in $files) {
        $fullPath = Join-Path $phaseDir $file
        if (Test-Path $fullPath) {
            $found++
            $present += $file
        } else {
            $missing += $file
        }
    }

    $total = $files.Count
    $totalExpected += $total
    $totalFound += $found

    if ($found -eq 0 -and -not (Test-Path $phaseDir)) {
        $icon = [char]0x2014  # em dash
        $color = "DarkGray"
        $status = "not started"
    } elseif ($found -eq $total) {
        $icon = [char]0x2705  # checkmark
        $color = "Green"
        $status = "$found/$total artifacts"
    } else {
        $icon = [char]0x26A0  # warning
        $color = "Yellow"
        $status = "$found/$total artifacts"
    }

    Write-Host "  ${p}: " -NoNewline -ForegroundColor White
    Write-Host "$icon $status" -ForegroundColor $color

    if ($missing.Count -gt 0 -and (Test-Path $phaseDir)) {
        foreach ($m in $missing) {
            Write-Host "    missing: $m" -ForegroundColor DarkYellow
        }
    }
}

Write-Host ("{0}" -f ("-" * 40)) -ForegroundColor DarkGray
Write-Host "  Total: $totalFound / $totalExpected artifacts" -ForegroundColor White

