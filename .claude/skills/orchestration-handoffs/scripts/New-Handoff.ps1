<#
.SYNOPSIS
    Generates a correctly-formatted handoff or feedback message between agents.

.DESCRIPTION
    Creates a standardized handoff message with auto-populated artifact paths
    based on the source and target agents. Supports both forward handoffs and
    feedback loops (rejections/bug reports).

.PARAMETER From
    The agent completing its phase.

.PARAMETER To
    The agent receiving the handoff.

.PARAMETER ProjectName
    The project identifier (e.g., "user-auth").

.PARAMETER Findings
    Array of key findings or decisions to include in the handoff.

.PARAMETER IsFeedback
    Generate a feedback loop message (rejection / bugs found) instead of a forward handoff.

.PARAMETER Issues
    Array of issues for feedback messages. Format: "Description — Severity"

.EXAMPLE
    .\New-Handoff.ps1 -From "Researcher" -To "Architect" -ProjectName "user-auth" -Findings "OAuth 2.0 recommended"

.EXAMPLE
    .\New-Handoff.ps1 -From "Tester" -To "Developer" -ProjectName "user-auth" -IsFeedback -Issues "Login fails on empty email — Critical"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Orchestrator","Researcher","Architect","UI Designer","Planner","Developer","Code Reviewer","Tester")]
    [string]$From,

    [Parameter(Mandatory = $true)]
    [ValidateSet("Orchestrator","Researcher","Architect","UI Designer","Planner","Developer","Code Reviewer","Tester")]
    [string]$To,

    [Parameter(Mandatory = $true)]
    [string]$ProjectName,

    [string[]]$Findings = @(),
    [switch]$IsFeedback,
    [string[]]$Issues = @()
)

$ErrorActionPreference = "Stop"

# Map agents to their artifact phase directories
$agentPhase = @{
    "Researcher"    = "research"
    "Architect"     = "architecture"
    "UI Designer"   = "ui-design"
    "Planner"       = "planning"
    "Developer"     = "development"
    "Code Reviewer" = "reviews"
    "Tester"        = "testing"
}

# Map agents to their expected artifact files
$agentArtifacts = @{
    "Researcher"    = @("proposal.md","requirements.md","technical-constraints.md","specs/scenarios.md")
    "Architect"     = @("architecture.md","decisions/")
    "UI Designer"   = @("ui-spec.md","design-system.md","accessibility.md","flows/")
    "Planner"       = @("design.md","implementation-spec.md","story-breakdown.md")
    "Developer"     = @("implementation-notes.md","build-logs.txt")
    "Code Reviewer" = @("code-review-report.md")
    "Tester"        = @("test-results.md","test-coverage.md")
}

$phase = $agentPhase[$From]
$phaseLabel = ($phase -replace '-',' ').ToUpper()
$basePath = "/orchestration/artifacts/$phase/$ProjectName"

if ($IsFeedback) {
    $msg = @"
FEEDBACK FOR $($To.ToUpper())

$phaseLabel STATUS: Changes Required

ISSUES:
"@
    $i = 1
    foreach ($issue in $Issues) {
        $msg += "`n$i. $issue"
        $i++
    }

    $msg += @"

`nARTIFACTS:
"@
    foreach ($file in $agentArtifacts[$From]) {
        $msg += "`n- $basePath/$file"
    }

    $msg += @"

`nPLEASE ADDRESS:
- All critical issues before re-submission
- All major issues before re-submission
- Minor notes (style, future optimizations) do NOT block approval

READY FOR RE-REVIEW: After fixes applied
"@
} else {
    $msg = @"
HANDOFF TO $($To.ToUpper())

$phaseLabel COMPLETE: $ProjectName

ARTIFACTS:
"@
    foreach ($file in $agentArtifacts[$From]) {
        $msg += "`n- $basePath/$file"
    }

    $msg += @"

`nKEY FINDINGS / DECISIONS:
"@
    if ($Findings.Count -eq 0) {
        $msg += "`n- (none specified)"
    } else {
        foreach ($f in $Findings) { $msg += "`n- $f" }
    }

    $nextPhase = ($agentPhase[$To] -replace '-',' ').ToUpper()
    $msg += "`n`nREADY FOR ${nextPhase}: Yes"
}

Write-Host $msg
Write-Host "`n--- Handoff message generated ---" -ForegroundColor DarkGray

