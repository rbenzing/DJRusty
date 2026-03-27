---
name: dev-powershell-tools
description: PowerShell scripts for common developer tasks on Windows — file searching, git operations, project analysis, and build helpers. Designed for non-interactive AI agent execution.
---

# Dev PowerShell Tools

PowerShell scripts that simplify common developer tasks. All scripts are non-interactive, support `-Help` via comment-based help, and output structured text suitable for AI consumption.

**Always run scripts with `Get-Help` first** to see usage:
```powershell
Get-Help .claude/skills/dev-powershell-tools/scripts/Find-Code.ps1 -Full
```

## Available Scripts

### `Find-Code.ps1` — Search files by content or pattern
Recursively searches project files for a regex pattern, respecting `.gitignore` and common exclusions (node_modules, bin, obj, .git). Returns matches with file path, line number, and context.

```powershell
# Find all TODO comments
.claude/skills/dev-powershell-tools/scripts/Find-Code.ps1 -Pattern "TODO|FIXME|HACK"

# Search only TypeScript files
.claude/skills/dev-powershell-tools/scripts/Find-Code.ps1 -Pattern "interface\s+I\w+" -Include "*.ts"

# Search with context lines
.claude/skills/dev-powershell-tools/scripts/Find-Code.ps1 -Pattern "catch\s*\(" -Context 2
```

### `Get-ProjectInfo.ps1` — Analyze project structure
Summarizes the project: file counts by extension, directory tree, detected frameworks, and key config files. Useful for onboarding an agent to an unfamiliar codebase.

```powershell
# Full project summary
.claude/skills/dev-powershell-tools/scripts/Get-ProjectInfo.ps1

# Limit directory depth
.claude/skills/dev-powershell-tools/scripts/Get-ProjectInfo.ps1 -Depth 2
```

### `Get-GitSummary.ps1` — Git status and history at a glance
Shows current branch, uncommitted changes, recent commits, and branch list in a compact format.

```powershell
# Quick status
.claude/skills/dev-powershell-tools/scripts/Get-GitSummary.ps1

# Include last N commits
.claude/skills/dev-powershell-tools/scripts/Get-GitSummary.ps1 -LogCount 20
```

## Design Principles

- **Non-interactive**: No prompts or confirmations — all input via parameters
- **Structured output**: Clean, parseable text output to stdout; diagnostics to stderr
- **Idempotent**: Safe to run repeatedly with no side effects (read-only scripts)
- **Git-aware**: Respects `.gitignore` patterns and excludes build artifacts
- **Windows-native**: Uses PowerShell idioms, backslash paths, and Windows-compatible commands

