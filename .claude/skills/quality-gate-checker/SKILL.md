---
name: quality-gate-checker
description: Programmatic quality gate validation for the 8-phase orchestration pipeline — verifies artifact completeness and checklist compliance before phase transitions.
---

# Quality Gate Checker

Provides programmatic validation of quality gates at each phase boundary. Instead of relying on agents to self-report checklist completion, this skill verifies that required artifacts exist and contain expected sections.

## Quality Gates by Phase

### Research → Architecture
- [ ] `proposal.md` exists and has sections: Why, What's Changing, Goals, Success Criteria, Out of Scope
- [ ] `requirements.md` exists and has sections: Functional, Non-Functional, Constraints
- [ ] `technical-constraints.md` exists
- [ ] `specs/scenarios.md` exists
- [ ] `specs/spec-before.md` exists *(migrations only)*
- [ ] No critical ambiguities flagged without resolution

### Architecture → UI Design / Planning
- [ ] `architecture.md` exists and has sections: Overview, Architecture Style, System Layers, Core Components, Data Flow
- [ ] At least one ADR in `decisions/`
- [ ] Diagrams created where they add clarity

### UI Design → Planning
- [ ] `ui-spec.md` exists with Screen Inventory, Component Tree, Component Catalog
- [ ] `design-system.md` exists with Tokens section
- [ ] `accessibility.md` exists with WCAG Compliance Matrix
- [ ] `migration-map.md` exists *(migrations only)*

### Planning → Development
- [ ] `design.md` exists with Architecture Overview, Component Specs, Data Models
- [ ] `implementation-spec.md` exists with at least one Implementation Item
- [ ] `story-breakdown.md` exists with at least one Story
- [ ] `spec-after.md` exists *(migrations only)*

### Development → Code Review
- [ ] `implementation-notes.md` exists with Build Status section
- [ ] `build-logs.txt` exists
- [ ] Build status shows passing
- [ ] All implementation items marked complete

### Code Review → Testing
- [ ] `code-review-report.md` exists
- [ ] Overall Assessment status is APPROVED
- [ ] No critical or major issues open

### Testing → Complete
- [ ] `test-results.md` exists
- [ ] Overall Assessment status is PASSED
- [ ] Acceptance criteria 100% met
- [ ] No critical or major bugs open

## Scripts

### `Test-QualityGate.ps1` — Validate a phase gate

Checks whether a project is ready to transition from one phase to the next.

```powershell
# Check if research phase is complete
.claude/skills/quality-gate-checker/scripts/Test-QualityGate.ps1 `
  -ProjectName "user-auth" -Phase "research"

# Check with migration mode
.claude/skills/quality-gate-checker/scripts/Test-QualityGate.ps1 `
  -ProjectName "billing-migration" -Phase "research" -IsMigration

# Check all phases at once
.claude/skills/quality-gate-checker/scripts/Test-QualityGate.ps1 `
  -ProjectName "user-auth" -Phase "all"
```

### `Get-ArtifactStatus.ps1` — Quick status dashboard

Shows a summary of all artifact phases and their completion status.

```powershell
.claude/skills/quality-gate-checker/scripts/Get-ArtifactStatus.ps1 -ProjectName "user-auth"
```

Output:
```
Project: user-auth
──────────────────────────
  Research:     ✅ 5/5 artifacts
  Architecture: ✅ 3/3 artifacts
  UI Design:    ⚠️ 3/4 artifacts (missing: accessibility.md)
  Planning:     ❌ 0/3 artifacts
  Development:  — not started
  Reviews:      — not started
  Testing:      — not started
```

