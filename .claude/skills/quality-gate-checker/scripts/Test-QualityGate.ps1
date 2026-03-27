<#
.SYNOPSIS
    Validates whether a project is ready to transition past a phase's quality gate.

.DESCRIPTION
    Checks that required artifacts exist and contain expected section headers
    for a given phase. Returns pass/fail with details on what's missing.

.PARAMETER ProjectName
    The project identifier (e.g., "user-auth").

.PARAMETER Phase
    The phase to validate: research, architecture, ui-design, planning,
    development, reviews, testing, or "all".

.PARAMETER IsMigration
    Include migration-specific checks (spec-before, migration-map, spec-after).

.PARAMETER Root
    Repository root directory. Defaults to current directory.

.EXAMPLE
    .\Test-QualityGate.ps1 -ProjectName "user-auth" -Phase "research"

.EXAMPLE
    .\Test-QualityGate.ps1 -ProjectName "billing-migration" -Phase "all" -IsMigration
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ProjectName,

    [Parameter(Mandatory = $true, Position = 1)]
    [ValidateSet("all","research","architecture","ui-design","planning",
                 "development","reviews","testing")]
    [string]$Phase,

    [switch]$IsMigration,

    [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$base = Join-Path $Root "orchestration" "artifacts"

function Test-FileWithSections {
    param([string]$FilePath, [string[]]$RequiredSections)
    $result = @{ Exists = $false; MissingSections = @() }
    if (-not (Test-Path $FilePath)) { return $result }
    $result.Exists = $true
    if ($RequiredSections.Count -eq 0) { return $result }
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return $result }
    foreach ($section in $RequiredSections) {
        if ($content -notmatch "(?i)#.*$([regex]::Escape($section))") {
            $result.MissingSections += $section
        }
    }
    return $result
}

# Define gates: file => required section keywords
$gates = [ordered]@{
    "research" = @{
        "proposal.md"              = @("Why","Goals","Scope")
        "requirements.md"          = @("Functional","Non-Functional")
        "technical-constraints.md" = @()
        "specs/scenarios.md"       = @()
    }
    "architecture" = @{
        "architecture.md" = @("Overview","Components","Data")
    }
    "ui-design" = @{
        "ui-spec.md"       = @("Screen","Component")
        "design-system.md" = @("Tokens")
        "accessibility.md" = @("WCAG")
    }
    "planning" = @{
        "design.md"              = @("Architecture","Component","Data")
        "implementation-spec.md" = @()
        "story-breakdown.md"     = @()
    }
    "development" = @{
        "implementation-notes.md" = @("Build Status")
    }
    "reviews" = @{
        "code-review-report.md" = @("Overall Assessment")
    }
    "testing" = @{
        "test-results.md" = @("Overall Assessment","Acceptance Criteria")
    }
}

# Migration extras
$migrationGates = @{
    "research"  = @{ "specs/spec-before.md" = @() }
    "ui-design" = @{ "migration-map.md" = @("Source","Target") }
    "planning"  = @{ "spec-after.md" = @("Target","AST") }
}

$phasesToCheck = if ($Phase -eq "all") { $gates.Keys } else { @($Phase) }
$allPassed = $true

Write-Host "`nQuality Gate Check: $ProjectName" -ForegroundColor White
Write-Host ("{0}" -f ("=" * 45)) -ForegroundColor DarkGray

foreach ($p in $phasesToCheck) {
    $phaseDir = Join-Path $base $p $ProjectName
    $checks = $gates[$p].Clone()

    if ($IsMigration -and $migrationGates.ContainsKey($p)) {
        foreach ($k in $migrationGates[$p].Keys) {
            $checks[$k] = $migrationGates[$p][$k]
        }
    }

    $passed = 0; $failed = 0; $details = @()
    foreach ($file in $checks.Keys) {
        $fullPath = Join-Path $phaseDir $file
        $result = Test-FileWithSections -FilePath $fullPath -RequiredSections $checks[$file]
        if (-not $result.Exists) {
            $failed++; $details += "  [MISSING] $file"
        } elseif ($result.MissingSections.Count -gt 0) {
            $failed++; $details += "  [INCOMPLETE] $file — missing sections: $($result.MissingSections -join ', ')"
        } else {
            $passed++
        }
    }

    $total = $passed + $failed
    $icon = if ($failed -eq 0) { [char]0x2705 } else { [char]0x274C }
    $color = if ($failed -eq 0) { "Green" } else { "Red" }

    Write-Host "`n  $p $icon ($passed/$total passed)" -ForegroundColor $color
    foreach ($d in $details) { Write-Host $d -ForegroundColor Yellow }

    if ($failed -gt 0) { $allPassed = $false }
}

Write-Host "`n$("=" * 45)" -ForegroundColor DarkGray
if ($allPassed) {
    Write-Host "RESULT: ALL GATES PASSED" -ForegroundColor Green
} else {
    Write-Host "RESULT: GATE(S) FAILED — address missing items before proceeding" -ForegroundColor Red
}

