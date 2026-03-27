---
name: orchestration-handoffs
description: Standardized handoff protocol for the 8-phase orchestration pipeline — ensures every agent transition includes required metadata, artifact paths, and context.
---

# Orchestration Handoffs

Defines the universal handoff protocol used when one agent completes a phase and passes work to the next agent. All agents must follow this format to ensure smooth transitions and zero lost context.

## Handoff Format

Every handoff message follows this structure:

```
HANDOFF TO {TARGET AGENT}

{PHASE} COMPLETE: {Project Name}

ARTIFACTS:
- {Label}: /orchestration/artifacts/{phase}/{project-name}/{file}
  (one line per artifact created)

KEY FINDINGS / DECISIONS:
- {Finding or decision 1}
- {Finding or decision 2}

CRITICAL NOTES:
- {Note 1}
- {Note 2}

READY FOR {NEXT PHASE}: Yes
```

## Agent Transition Map

| From | To | Trigger |
|---|---|---|
| **Orchestrator** | Researcher | Project brief approved |
| **Researcher** | Architect | Research complete, quality gate passed |
| **Architect** | UI Designer | Architecture complete (if UI work) |
| **Architect** | Planner | Architecture complete (no UI work) |
| **UI Designer** | Planner | UI specifications complete |
| **Planner** | Developer | Stories and specs ready |
| **Developer** | Code Reviewer | Code complete, build passing |
| **Code Reviewer** | Tester | Code approved (100% compliant) |
| **Code Reviewer** | Developer | Code rejected (issues found) |
| **Tester** | Orchestrator | All tests passed |
| **Tester** | Developer | Bugs found |

## Feedback Loop Format

When returning work to a previous agent:

```
FEEDBACK FOR {TARGET AGENT}

{PHASE} STATUS: {Changes Required | Bugs Found}

ISSUES:
1. {Issue 1} — {Severity}
2. {Issue 2} — {Severity}

ARTIFACTS:
- {Report}: /orchestration/artifacts/{phase}/{project-name}/{file}

PLEASE ADDRESS:
- All critical issues before re-submission
- All major issues before re-submission
- Minor notes (style, future optimizations) do NOT block approval

READY FOR RE-{PHASE}: After fixes applied
```

## Rules

1. **Never skip the handoff message** — even for streamlined workflows
2. **Always list artifacts with full paths** — agents must be able to find every file
3. **Always include at least one key finding/decision** — context must transfer
4. **Feedback loops must reference specific issues** — "fix the problems" is not acceptable
5. **The receiving agent should be able to start work immediately** from the handoff alone

## Script

### `New-Handoff.ps1` — Generate handoff messages

Creates a correctly-formatted handoff message with artifact paths auto-populated.

```powershell
# Generate a researcher→architect handoff
.claude/skills/orchestration-handoffs/scripts/New-Handoff.ps1 `
  -From "Researcher" -To "Architect" `
  -ProjectName "user-auth" `
  -Findings "OAuth 2.0 recommended over JWT-only", "Rate limiting required per NFR-3"

# Generate a feedback loop (code reviewer → developer)
.claude/skills/orchestration-handoffs/scripts/New-Handoff.ps1 `
  -From "Code Reviewer" -To "Developer" `
  -ProjectName "user-auth" `
  -IsFeedback `
  -Issues "Missing input validation on /api/users endpoint — Critical", "No error handling in paymentService.ts — Major"
```

