---
type: "agent_requested"
description: "Single-agent persona activation and workflow coordination triggered on orchestrator"
---

# Agent System - Workflow & Activation

## Keyword Triggers - Auto-Activation

Monitor user messages for these keywords and auto-activate the agent system:

### Agent Keywords
- "planning agent" - Activate Planning Agent Persona
- "development agent" - Activate Development Agent Persona
- "testing agent" - Activate Testing Agent Persona
- "research agent" - Activate Research Agent Persona
- "architecture agent" - Activate Architecture Agent Persona
- "ui agent" - Activate UI Design Agent Persona
- "code review agent" - Activate Code Review Agent Persona

## Activation Protocol

When agent keywords are detected:

1. **Immediately respond with**:
   ```
   🎯 **Agent Persona Activated**

   I am now operating as the **{Agent Name} Persona** - your personal assistant for various tasks.
   ```

2. **Load the Agent role based on chosen mode**:
   - **CLI Mode**: Use `.claude/agents/` subagent configs for spawning multiple parallel agents
   - **Role-Playing Mode**: Read and follow `/orchestration/prompts/01-orchestrator.md`
