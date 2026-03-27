<#
.SYNOPSIS
    Displays a compact git status and history summary.

.DESCRIPTION
    Shows current branch, working tree status, recent commit log, and branch list
    in a single compact view. Designed for AI agents to quickly understand the
    current state of a git repository.

.PARAMETER Path
    Repository root directory. Defaults to the current directory.

.PARAMETER LogCount
    Number of recent commits to show. Default: 10.

.PARAMETER ShowStash
    Include stash list in the output.

.EXAMPLE
    .\Get-GitSummary.ps1

.EXAMPLE
    .\Get-GitSummary.ps1 -LogCount 20 -ShowStash
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Path = (Get-Location).Path,

    [int]$LogCount = 10,

    [switch]$ShowStash
)

$ErrorActionPreference = "Stop"

Push-Location $Path
try {
    # Verify git repo
    $gitDir = git rev-parse --git-dir 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Not a git repository: $Path"
        exit 1
    }

    Write-Host "=== Git Summary ===" -ForegroundColor Cyan
    Write-Host "Repository: $Path"
    Write-Host ""

    # Current branch and tracking
    $branch = git branch --show-current 2>$null
    if (-not $branch) { $branch = "(detached HEAD)" }
    $tracking = git rev-parse --abbrev-ref "@{upstream}" 2>$null
    $trackInfo = if ($tracking) { " -> $tracking" } else { " (no upstream)" }
    Write-Host "--- Branch ---" -ForegroundColor Yellow
    Write-Host "  Current: $branch$trackInfo"

    # Ahead/behind
    if ($tracking) {
        $ahead = (git rev-list --count "@{upstream}..HEAD" 2>$null)
        $behind = (git rev-list --count "HEAD..@{upstream}" 2>$null)
        if ($ahead -gt 0 -or $behind -gt 0) {
            Write-Host "  Ahead: $ahead | Behind: $behind"
        } else {
            Write-Host "  Up to date with upstream"
        }
    }
    Write-Host ""

    # Working tree status
    Write-Host "--- Working Tree ---" -ForegroundColor Yellow
    $status = git status --porcelain 2>$null
    if ($status) {
        $staged = ($status | Where-Object { $_ -match '^[MADRC]' }).Count
        $modified = ($status | Where-Object { $_ -match '^.[MD]' }).Count
        $untracked = ($status | Where-Object { $_ -match '^\?\?' }).Count
        Write-Host "  Staged: $staged | Modified: $modified | Untracked: $untracked"
        Write-Host ""
        # Show first 20 changed files
        $status | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
        if ($status.Count -gt 20) {
            Write-Host "  ... and $($status.Count - 20) more"
        }
    } else {
        Write-Host "  Clean working tree"
    }
    Write-Host ""

    # Recent commits
    Write-Host "--- Recent Commits ($LogCount) ---" -ForegroundColor Yellow
    $log = git log --oneline --decorate -n $LogCount 2>$null
    if ($log) {
        $log | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "  (no commits yet)"
    }
    Write-Host ""

    # Branches
    Write-Host "--- Branches ---" -ForegroundColor Yellow
    $branches = git branch -a --format="%(refname:short)" 2>$null
    $localBranches = $branches | Where-Object { $_ -notmatch '^origin/' }
    $remoteBranches = $branches | Where-Object { $_ -match '^origin/' }
    Write-Host "  Local ($($localBranches.Count)):"
    $localBranches | ForEach-Object {
        $marker = if ($_ -eq $branch) { " *" } else { "  " }
        Write-Host "  $marker $_"
    }
    if ($remoteBranches) {
        Write-Host "  Remote ($($remoteBranches.Count)):"
        $remoteBranches | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" }
        if ($remoteBranches.Count -gt 10) {
            Write-Host "    ... and $($remoteBranches.Count - 10) more"
        }
    }
    Write-Host ""

    # Stash
    if ($ShowStash) {
        Write-Host "--- Stash ---" -ForegroundColor Yellow
        $stash = git stash list 2>$null
        if ($stash) {
            $stash | ForEach-Object { Write-Host "  $_" }
        } else {
            Write-Host "  (no stashes)"
        }
        Write-Host ""
    }

    Write-Host "=== End of Git Summary ===" -ForegroundColor Cyan
} finally {
    Pop-Location
}

