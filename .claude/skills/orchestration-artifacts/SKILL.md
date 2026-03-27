---
name: orchestration-artifacts
description: Single source of truth for artifact directory structure, naming conventions, and project initialization across the 8-phase orchestration pipeline.
---

# Orchestration Artifacts

Defines the canonical directory layout for all orchestration artifacts. Every agent in the pipeline stores deliverables under `/orchestration/artifacts/` using the structure below.

## Directory Structure

```
orchestration/artifacts/
├── research/{project-name}/
│   ├── proposal.md
│   ├── requirements.md
│   ├── technical-constraints.md
│   ├── context.md                  (optional — complex projects)
│   └── specs/
│       ├── scenarios.md
│       └── spec-before.md          (migrations only)
│
├── architecture/{project-name}/
│   ├── architecture.md
│   ├── decisions/
│   │   └── adr-001-{topic}.md
│   └── diagrams/
│
├── ui-design/{project-name}/
│   ├── ui-spec.md
│   ├── design-system.md
│   ├── accessibility.md
│   ├── migration-map.md            (migrations only)
│   └── flows/
│
├── planning/{project-name}/
│   ├── design.md
│   ├── implementation-spec.md
│   ├── story-breakdown.md
│   └── spec-after.md               (migrations only)
│
├── development/{project-name}/
│   ├── implementation-notes.md
│   └── build-logs.txt
│
├── reviews/{project-name}/
│   ├── code-review-report.md
│   └── feedback.md                 (if changes needed)
│
└── testing/{project-name}/
    ├── test-results.md
    ├── bug-reports.md              (if bugs found)
    └── test-coverage.md
```

## Naming Conventions

- **Project name**: lowercase, hyphenated (e.g., `user-auth`, `billing-migration`)
- **ADR files**: `adr-NNN-{topic}.md` — zero-padded 3-digit sequence
- **All artifact files**: use the exact names above — agents depend on predictable paths

## Rules

1. **Source code goes OUTSIDE `/orchestration/`** — only planning/coordination artifacts live here
2. Each phase owns its subdirectory — agents must not write into another phase's directory
3. Artifacts are append-only during a phase — previous phase artifacts are read-only references
4. The `{project-name}` slug must be consistent across all phases for a given project

## Scripts

### `Initialize-Artifacts.ps1` — Create project directories

Creates the full artifact directory tree for a new project.

```powershell
# Initialize artifact directories for a new project
.claude/skills/orchestration-artifacts/scripts/Initialize-Artifacts.ps1 -ProjectName "user-auth"

# Include migration-specific files
.claude/skills/orchestration-artifacts/scripts/Initialize-Artifacts.ps1 -ProjectName "billing-migration" -IsMigration
```

### `Get-ArtifactInventory.ps1` — Check artifact completeness

Lists all expected and existing artifacts for a project, showing which are present and which are missing.

```powershell
# Check artifact status for a project
.claude/skills/orchestration-artifacts/scripts/Get-ArtifactInventory.ps1 -ProjectName "user-auth"

# Check a specific phase only
.claude/skills/orchestration-artifacts/scripts/Get-ArtifactInventory.ps1 -ProjectName "user-auth" -Phase "research"
```

