<#
.SYNOPSIS
    Creates the orchestration artifact directory tree for a new project.

.DESCRIPTION
    Initializes the standard `/orchestration/artifacts/{phase}/{project-name}/`
    directory structure used by all agents in the 8-phase pipeline.
    Optionally creates migration-specific placeholder files.

.PARAMETER ProjectName
    Lowercase, hyphenated project identifier (e.g., "user-auth").

.PARAMETER IsMigration
    Include migration-specific artifact placeholders (spec-before, migration-map, spec-after).

.PARAMETER Root
    Repository root directory. Defaults to current directory.

.EXAMPLE
    .\Initialize-Artifacts.ps1 -ProjectName "user-auth"

.EXAMPLE
    .\Initialize-Artifacts.ps1 -ProjectName "billing-migration" -IsMigration
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidatePattern('^[a-z][a-z0-9-]*$')]
    [string]$ProjectName,

    [switch]$IsMigration,

    [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$base = Join-Path $Root "orchestration" "artifacts"

# Phase directories and their standard files
$phases = [ordered]@{
    "research"     = @("proposal.md", "requirements.md", "technical-constraints.md", "specs/scenarios.md")
    "architecture" = @("architecture.md", "decisions/.gitkeep", "diagrams/.gitkeep")
    "ui-design"    = @("ui-spec.md", "design-system.md", "accessibility.md", "flows/.gitkeep")
    "planning"     = @("design.md", "implementation-spec.md", "story-breakdown.md")
    "development"  = @("implementation-notes.md")
    "reviews"      = @("code-review-report.md")
    "testing"      = @("test-results.md", "test-coverage.md")
}

# Migration-only additions
$migrationExtras = @{
    "research"  = @("specs/spec-before.md")
    "ui-design" = @("migration-map.md")
    "planning"  = @("spec-after.md")
}

$created = 0
foreach ($phase in $phases.Keys) {
    $phaseDir = Join-Path $base $phase $ProjectName

    $filesToCreate = [System.Collections.ArrayList]::new()
    $filesToCreate.AddRange($phases[$phase])
    if ($IsMigration -and $migrationExtras.ContainsKey($phase)) {
        $filesToCreate.AddRange($migrationExtras[$phase])
    }

    foreach ($file in $filesToCreate) {
        $fullPath = Join-Path $phaseDir $file
        $dir = Split-Path $fullPath -Parent
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        if (-not (Test-Path $fullPath)) {
            # Create placeholder with a title comment
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file)
            if ($file -like "*.md") {
                Set-Content -Path $fullPath -Value "# $($baseName -replace '-',' ' -replace '(^| )(\w)', { $_.Groups[2].Value.ToUpper() })`n`n> TODO: Complete this artifact for project ``$ProjectName``" -Encoding utf8
            } else {
                New-Item -ItemType File -Path $fullPath -Force | Out-Null
            }
            $created++
        }
    }
}

Write-Host "Initialized artifact tree for '$ProjectName'" -ForegroundColor Green
Write-Host "  Root:       $base" -ForegroundColor DarkGray
Write-Host "  Migration:  $IsMigration" -ForegroundColor DarkGray
Write-Host "  Created:    $created files" -ForegroundColor DarkGray

