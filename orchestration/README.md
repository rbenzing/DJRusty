# Multi-Agent Orchestration System

> Coordinate 8 specialized AI agents to deliver high-quality, tested code through structured development phases.

## Table of Contents

- [Overview](#overview)
- [Dual-Mode Architecture](#dual-mode-architecture)
- [Features](#features)
- [Setup](#setup)
- [Quick Start](#quick-start)
- [The 8 Agents](#the-8-agents)
- [Workflow](#workflow)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Examples](#examples)
- [Agent Prompts](#agent-prompts)
- [Configuration](#configuration)
- [Parallel Execution (CLI Mode)](#parallel-execution-cli-mode)
- [Best Practices](#best-practices)

## Overview

This system orchestrates 8 specialized AI agents working together to complete full-stack development projects. Each agent has a specific role (Research, Architecture, UI Design, Planning, Development, Code Review, Testing) coordinated by an Orchestrator agent that manages the workflow and ensures quality gates are met.

## Dual-Mode Architecture

This orchestration system supports **two execution modes** depending on your environment:

### 🖥️ VS Code Extension Mode (Single-Agent Role-Playing)

**How it works:**
- One AI agent assumes different roles sequentially
- Reads different prompt files for each role
- Creates artifacts as each persona
- Sequential execution (one agent at a time)

**Pros:**
- ✅ Works directly in VS Code
- ✅ Simple setup
- ✅ Maintains context across all phases
- ✅ No CLI required

**Cons:**
- ❌ Sequential execution (slower)
- ❌ Not true parallel multi-agent

**Files used:**
- `/.claude/rules/orchestration-workflow.md` - Main orchestrator logic
- `/orchestration/prompts/*.md` - Role prompts for each agent

### 🚀 Auggie CLI Mode (True Multi-Agent)

**How it works:**
- Spawns independent subagent instances
- Each subagent has its own context window
- Subagents run in parallel
- Subagents communicate via shared artifacts
- **NEW**: Multiple instances of same agent type for parallel work

**Pros:**
- ✅ TRUE parallel multi-agent execution
- ✅ Independent context windows per agent
- ✅ Faster execution (3-5x for large projects)
- ✅ Specialized agent instances
- ✅ **Multiple developers working simultaneously**
- ✅ **Dynamic scaling based on workload**
- ✅ **Work queue management**

**Cons:**
- ❌ Requires Auggie CLI installation
- ❌ More complex setup

**Files used:**
- `/.claude/rules/orchestration-workflow.md` - Main orchestrator logic
- `/.claude/agents/*.md` - Subagent configurations for Auggie CLI

**Parallel Execution Example:**
```
10 stories → Spawn 3 developers
@developer-1 → Story #1
@developer-2 → Story #2  } Working in parallel
@developer-3 → Story #3

Each completes → Review → Test → Next story
3-5x faster than sequential!
```

### Which Mode Should I Use?

| Scenario | Recommended Mode |
|----------|------------------|
| Working in VS Code IDE | VS Code Extension Mode |
| Want simplest setup | VS Code Extension Mode |
| Need faster execution | Auggie CLI Mode |
| Want true parallel agents | Auggie CLI Mode |
| Automating workflows | Auggie CLI Mode |

**Both modes use the same:**
- OpenSpec Spec Before/After methodology
- Story-by-story workflow
- Quality gates
- Artifact structure (`/orchestration/artifacts/`)

**Inspired by [OpenSpec](https://github.com/Fission-AI/OpenSpec)**: We follow spec-driven development principles - agree before you build, stay organized, work fluidly.

**Key Benefits:**
- **Spec-driven workflow**: Align on what to build before writing code
- **Structured artifacts**: Proposals, specs, design docs, and task lists
- **Quality gates**: Each phase must meet standards before proceeding
- **Iterative and fluid**: Update any artifact anytime, no rigid phase gates
- **Complete traceability**: All decisions and work documented

## Features

- 🎯 **Auto-Trigger**: Say "orchestrator" to activate the system
- 🔄 **8-Phase Workflow**: Research → Architecture → UI Design → Plan → Develop → Review → Test → Complete
- ✅ **Quality Gates**: Each phase must meet standards before proceeding
- 🔁 **Feedback Loops**: Automatic iteration for quality improvement
- 📝 **Documentation**: All work documented in `/orchestration/artifacts/`
- 🛡️ **Best Practices**: Security, testing, and code quality built-in
- 📖 **Story-by-Story**: Enforces one story at a time with quality gates between each
- 🚀 **Parallel Execution** (CLI Mode): Multiple agents working simultaneously
- 📊 **Dynamic Scaling**: Auto-scales agents based on workload
- 🔍 **Intelligent Mode Detection**: Automatically detects CLI vs VS Code Extension mode

## Setup

### For VS Code Extension Mode

To use this orchestration system in VS Code:

1. **Run the installer** (from the orchestrator repo):
   ```powershell
   # Double-click install.bat, or run from PowerShell:
   .\install.ps1 -Target "C:\Src\MyProject"
   ```

2. **Verify setup**:
   - Check that `/orchestration/` exists with all prompts
   - Check that `/.claude/rules/` exists with rule files
   - Restart Augment or reload the workspace

3. **Test activation**:
   ```
   Type: "orchestrator"
   Expected: "🎯 Orchestration System Activated"
   ```

### For Auggie CLI Mode (True Multi-Agent)

To use true multi-agent orchestration with Auggie CLI:

1. **Install Auggie CLI** (if not already installed):
   ```bash
   npm install -g @claudecode/cli
   # or
   brew install claude-cli
   ```

2. **Run the installer** (from the orchestrator repo):
   ```powershell
   # Double-click install.bat, or run from PowerShell:
   .\install.ps1 -Target "C:\Src\MyProject"
   ```

3. **Verify subagent configs exist**:
   ```bash
   ls .claude/agents/
   # Should show: researcher.md, architect.md, ui-designer.md, planner.md, developer.md, code-reviewer.md, tester.md
   ```

4. **Test subagent activation**:
   ```bash
   auggie chat
   > orchestrator
   ```

   After activation, request a project:
   ```bash
   > Build a hello world app with Node.js
   ```

   The orchestrator will spawn subagents as needed:
   - `@researcher` - For research phase
   - `@architect` - For architecture phase
   - `@ui-designer` - For UI design phase
   - `@planner` - For planning phase
   - `@developer` - For development phase
   - `@code-reviewer` - For code review phase
   - `@tester` - For testing phase

5. **View active subagents**:
   ```bash
   # In Auggie CLI interactive mode
   /agents
   ```

### What Gets Loaded

**Both Modes:**
- `/.claude/rules/orchestration-workflow.md` - Complete orchestration system
  - Auto-activation on keywords
  - **Intelligent mode detection** (CLI vs VS Code Extension)
  - Agent roles and workflow coordination
  - Story-by-story development enforcement
  - Quality gates and best practices
  - **Parallel execution strategy** (CLI mode)
  - **Dynamic agent scaling rules**

**VS Code Extension Mode Only:**
- `/orchestration/prompts/*.md` - Role prompts for sequential role-playing

**Auggie CLI Mode Only:**
- `/.claude/agents/*.md` - Subagent configurations for parallel execution

### Mode Detection

The system **automatically detects** which mode to use:

1. **Checks for `.claude/agents/`** directory first
   - If found → CLI Mode (parallel execution enabled)
   - Announces: "🚀 **CLI Mode Detected** - Using true multi-agent parallel execution"

2. **Falls back to `/orchestration/prompts/`** directory
   - If found → VS Code Extension Mode (sequential execution)
   - Announces: "🖥️ **VS Code Extension Mode Detected** - Using sequential role-playing"

3. **If neither found** → Configuration error
   - Announces: "⚠️ **Configuration Error** - Missing agent configs"
   - Provides setup instructions

**No manual configuration needed!** The system adapts automatically.

## Quick Start

### Activation

Type **"orchestrator"** to activate the system:

```
You: "orchestrator"

AI: 🎯 Orchestration System Activated

    I am now operating as the Orchestrator Agent - your project manager
    coordinating the multi-agent development team.
```

### Making Requests

After activation, describe what you want to build:

```
You: "Build a blog API with Node.js and PostgreSQL"

AI: [Orchestrator] Creating project brief...
    [Orchestrator] Assigning to Researcher...
    [Researcher] Analyzing requirements...
    [Researcher] Creating proposal and specs...
    [Architect] Designing system architecture...
    [UI Designer] Creating UI specifications...
    [Planner] Creating technical plan and stories...
    [Developer] Implementing Story #1...
    [Code Reviewer] Reviewing code...
    [Tester] Running tests...
```

### Example Requests

After typing "orchestrator", you can request:
- `"Build a REST API with authentication"`
- `"Create a todo app with React and Node.js"`
- `"Develop a user management system"`
- `"Implement a payment processing service"`

## The 8 Agents

| Agent | Role | Responsibility |
|-------|------|----------------|
| **Orchestrator** | Project Manager | Coordinates workflow, manages quality gates |
| **Researcher** | Problem Analyst | Analyzes requirements, creates context |
| **Architect** | System Architect | Designs system architecture, ADRs, component boundaries |
| **UI Designer** | UI/UX Specialist | Creates UI specifications, design systems, accessibility specs |
| **Planner** | Technical Planner | Creates stories and implementation plans |
| **Developer** | Software Engineer | Implements code, writes tests |
| **Code Reviewer** | Quality Specialist | Reviews code quality and security |
| **Tester** | QA Engineer | Validates functionality, reports bugs |

## Workflow

```
Orchestrator → Researcher → Architect → UI Designer → Planner → Developer → Code Reviewer → Tester → Complete
                                                                     ↑              ↓              ↓
                                                                     └──────────────┴──────────────┘
                                                                         Feedback Loops
```

**Phases:**
1. **Research**: Creates proposal.md and specs/ (requirements, scenarios)
2. **Architecture**: Designs system architecture, ADRs, component boundaries
3. **UI Design**: Creates UI specifications, design system, accessibility specs
4. **Planning**: Creates design.md and tasks.md (implementation checklist)
5. **Development**: Implements tasks, writes tests, verifies build
6. **Code Review**: Reviews quality, security, best practices
7. **Testing**: Validates acceptance criteria, reports bugs
8. **Completion**: Final approval, deployment readiness

**Artifacts Created** (OpenSpec-inspired):
- `proposal.md` - Why we're doing this, what's changing
- `specs/` - Requirements and user scenarios
- `design.md` - Technical approach and architecture
- `tasks.md` - Implementation checklist with clear tasks

## Usage

### VS Code Extension Mode Usage

**Automatic Mode (Recommended)**

The AI assumes all roles sequentially and completes the workflow:

```
You: "orchestrator"

AI: 🎯 Orchestration System Activated
    🖥️ VS Code Extension Mode Detected - Using sequential role-playing

You: "Build a todo app with React and Node.js"

AI: [Orchestrator] Creating project brief...
AI: [Researcher] Analyzing requirements... (reads 02-researcher.md)
AI: [Architect] Designing system architecture... (reads 03-architect.md)
AI: [UI Designer] Creating UI specifications... (reads 04-ui-designer.md)
AI: [Planner] Creating technical plan... (reads 05-planner.md)
AI: [Developer] Implementing Story #1... (reads 06-developer.md)
AI: [Code Reviewer] Reviewing code... (reads 07-code-reviewer.md)
AI: [Tester] Testing Story #1... (reads 08-tester.md)
AI: [Orchestrator] Story #1 complete, assigning Story #2...
```

**Step-by-Step Mode**

Guide the AI through each phase:

```
You: "orchestrator"
AI: [Orchestrator] Orchestration System Activated

You: "Build a REST API"
AI: [Orchestrator] Creating project brief...
AI: [Researcher] Analyzing requirements...
```

### Auggie CLI Mode Usage

**Spawning Subagents**

The orchestrator spawns independent subagent instances:

```bash
$ auggie chat
> orchestrator

🎯 Orchestration System Activated
🚀 CLI Mode Detected - Using true multi-agent parallel execution

> Build a todo app with React and Node.js

[Orchestrator] Creating project brief...
[Orchestrator] Spawning @researcher subagent...

[@researcher] Analyzing requirements...
[@researcher] Creating Spec Before document...
[@researcher] Research complete. Handing off to @architect...

[Orchestrator] Spawning @architect subagent...

[@architect] Designing system architecture...
[@architect] Creating ADRs and component boundaries...
[@architect] Architecture complete. Handing off to @ui-designer...

[Orchestrator] Spawning @ui-designer subagent...

[@ui-designer] Creating UI specifications...
[@ui-designer] Defining design system and accessibility specs...
[@ui-designer] UI design complete. Handing off to @planner...

[Orchestrator] Spawning @planner subagent...

[@planner] Creating Spec After blueprint...
[@planner] Breaking down into stories...
[@planner] Planning complete. Handing off to @developer...

[Orchestrator] Spawning @developer subagent for Story #1...

[@developer] Implementing Story #1...
[@developer] Build verification: ✅ PASS
[@developer] Ready for review...

[Orchestrator] Spawning @code-reviewer subagent...

[@code-reviewer] Reviewing Story #1...
[@code-reviewer] ✅ APPROVED - Ready for testing

[Orchestrator] Spawning @tester subagent...

[@tester] Testing Story #1...
[@tester] ✅ ALL TESTS PASS

[Orchestrator] Story #1 complete! Assigning Story #2 to @developer...
```

**Viewing Active Subagents**

```bash
# In Auggie CLI interactive mode
/agents

# Output:
Active Subagents:
- @researcher (idle)
- @architect (idle)
- @ui-designer (idle)
- @planner (idle)
- @developer (working on Story #2)
- @code-reviewer (idle)
- @tester (idle)
```

### Project Location Rule ⚠️

**CRITICAL**: Project code is ALWAYS created OUTSIDE `/orchestration/`

✅ **Correct:**
```
/workspace-root/
  /orchestration/        # System files only
  /my-blog-api/          # ← Your project code HERE
    /src/
    /tests/
```

❌ **Wrong:**
```
/orchestration/my-blog-api/  # ← Never put projects here
```

## Project Structure

```
/orchestration/
├── README.md                    # This file
├── /prompts/                    # Agent role prompts (VS Code Extension Mode)
│   ├── 01-orchestrator.md       # Main coordinator
│   ├── 02-researcher.md         # Research & analysis
│   ├── 03-architect.md          # System architecture
│   ├── 04-ui-designer.md        # UI/UX design
│   ├── 05-planner.md            # Technical planning
│   ├── 06-developer.md          # Code implementation
│   ├── 07-code-reviewer.md      # Quality review
│   └── 08-tester.md             # Testing & validation
└── /artifacts/                  # Documentation outputs (shared by both modes)
    ├── /research/               # Context documents, Spec Before
    ├── /planning/               # Stories, plans, Spec After
    ├── /development/            # Implementation notes, build logs
    ├── /reviews/                # Code review reports
    └── /testing/                # Test results, bug reports

/.claude/                       # Augment configuration
├── settings.json                # Tool permissions and settings
├── /rules/                      # Always-loaded rules (both modes)
│   ├── orchestration-workflow.md    # Complete orchestration system
│   └── agent-workflow.md            # Single-agent workflow rules
├── /agents/                     # Subagent configs (Auggie CLI Mode only)
│   ├── researcher.md            # Researcher subagent
│   ├── architect.md             # Architect subagent
│   ├── ui-designer.md           # UI Designer subagent
│   ├── planner.md               # Planner subagent
│   ├── developer.md             # Developer subagent
│   ├── code-reviewer.md         # Code Reviewer subagent
│   └── tester.md                # Tester subagent
└── /skills/                     # Reusable skill definitions
    ├── dev-powershell-tools/    # PowerShell dev utilities
    ├── orchestration-artifacts/ # Artifact management scripts
    ├── orchestration-handoffs/  # Agent handoff scripts
    ├── quality-gate-checker/    # Quality gate validation
    └── windows-environment/     # Windows environment helpers

/your-project/                   # ← Your actual code
├── /src/
├── /tests/
└── package.json
```

### Key Directories

- **`/orchestration/prompts/`**: Agent role definitions and responsibilities
- **`/orchestration/artifacts/`**: Documentation outputs (markdown files only)
- **`/.claude/rules/`**: Always-loaded rules that control system behavior
- **`/.claude/skills/`**: Reusable skill scripts for agent capabilities
- **`/your-project/`**: Actual project code (NEVER inside `/orchestration/`)

## Examples

### Example 1: User Authentication System

**Input:**
```
You: "orchestrator"
AI: 🎯 Orchestration System Activated

You: "Build a JWT authentication system with login, registration, and password reset"
```

**Output:**
- Project code in `/user-auth-system/`
- `proposal.md` - Why JWT auth, what's changing
- `specs/requirements.md` - Functional and security requirements
- `specs/scenarios.md` - Login, registration, password reset flows
- `design.md` - JWT architecture, token handling, security measures
- `tasks.md` - Implementation checklist (auth service, middleware, endpoints)
- Implemented features with tests
- Code review report
- Test results (all passing)
- Ready for deployment

### Example 2: REST API

**Input:**
```
You: "orchestrator"
AI: 🎯 Orchestration System Activated

You: "Build a blog API with posts, comments, and users using Node.js and PostgreSQL"
```

**Workflow:**
1. **Research**: Creates proposal (why blog API), specs (CRUD requirements, API scenarios)
2. **Architecture**: Designs system architecture, ADRs, component boundaries
3. **UI Design**: Creates UI specifications, design system, accessibility specs
4. **Planning**: Creates design (REST architecture, data models), tasks (implement posts, comments, users)
5. **Development**: Implements controllers, services, models, tests
6. **Review**: Validates code quality, security, error handling
7. **Testing**: Tests all endpoints, edge cases, integration
8. **Complete**: Delivers working API with complete documentation

## Agent Prompts

Each agent has detailed instructions in `/orchestration/prompts/`:

- **01-orchestrator.md**: Project coordination, quality gates, decision-making
- **02-researcher.md**: Problem analysis, requirements, best practices
- **03-architect.md**: System architecture, ADRs, component boundaries
- **04-ui-designer.md**: UI specifications, design system, accessibility
- **05-planner.md**: Story creation, technical planning, task breakdown
- **06-developer.md**: Code implementation, testing, build verification
- **07-code-reviewer.md**: Quality review, security, standards compliance
- **08-tester.md**: Acceptance testing, bug reporting, validation

## Configuration

### Automatic Mode Detection

The system automatically detects which execution mode to use - **no manual configuration needed!**

#### Detection Priority

1. **CLI Mode** (Highest Priority)
   - Checks for: `.claude/agents/` directory
   - If found: Enables parallel multi-agent execution
   - Announcement: "🚀 **CLI Mode Detected** - Using true multi-agent parallel execution"

2. **VS Code Extension Mode** (Fallback)
   - Checks for: `/orchestration/prompts/` directory
   - If found: Enables sequential role-playing
   - Announcement: "🖥️ **VS Code Extension Mode Detected** - Using sequential role-playing"

3. **Configuration Error**
   - Neither directory found
   - Announcement: "⚠️ **Configuration Error** - Missing agent configs"
   - Provides setup instructions

#### Forcing a Specific Mode

You can force a specific mode by removing the unused directory:

**Force CLI Mode Only**:
```bash
# Remove prompts directory if you only use CLI
rm -rf orchestration/prompts/
```

**Force VS Code Extension Mode Only**:
```bash
# Remove agents directory if you only use VS Code Extension
rm -rf .claude/agents/
```

### Augment Rules (Always Loaded)

The system uses **one comprehensive Augment Rule** in `/.claude/rules/`:

- **`orchestration-workflow.md`** (type: agent_requested)
  - Auto-activation on keywords ("orchestrator")
  - **Intelligent mode detection** (CLI vs VS Code Extension)
  - Workflow coordination and phase management
  - Story-by-story development enforcement
  - Quality gates between each story
  - **Parallel execution strategy** (CLI mode)
  - **Dynamic agent scaling rules**
  - Agent role references and artifact locations
  - Project code location enforcement
  - Prevents batch processing of multiple stories

This rule is automatically loaded by Augment and doesn't require manual activation.

### Agent Instance Naming

When multiple instances are spawned in CLI mode, they use numbered suffixes:

```
@developer-1, @developer-2, @developer-3
@code-reviewer-1, @code-reviewer-2
@tester-1, @tester-2
```

### Work Queue Management (CLI Mode)

The orchestrator maintains a work queue for story assignment:

**Queue Behavior**:
1. **Story Assignment**: Next story assigned to first available developer
2. **Load Balancing**: Work distributed evenly across agent instances
3. **Dependency Tracking**: Stories with dependencies wait for prerequisites
4. **Handoff Management**:
   - Developer completes → Assigns to next available reviewer
   - Reviewer approves → Assigns to next available tester
   - Tester passes → Story marked complete, developer picks next story

### Artifact Management

All agents share artifacts in `/orchestration/artifacts/`:

**Directory Structure**:
```
/orchestration/artifacts/
├── /research/          # Shared research documents
├── /planning/          # Shared plans and stories
├── /development/       # Implementation notes per story
│   ├── story-1.md
│   ├── story-2.md
│   └── story-3.md
├── /reviews/           # Code review reports per story
│   ├── story-1-review.md
│   ├── story-2-review.md
│   └── story-3-review.md
└── /testing/           # Test results per story
    ├── story-1-tests.md
    ├── story-2-tests.md
    └── story-3-tests.md
```

**Naming Conventions** (for parallel execution):
- `story-{number}-{phase}.md`
- `developer-{instance}-notes.md`
- `review-{story}-{reviewer}.md`

### Performance Tuning

**For Small Projects (1-5 stories)**:
- Use **VS Code Extension Mode** for simplicity
- Or use CLI Mode with 1 agent per role
- Sequential execution is fine for small projects

**For Medium Projects (6-15 stories)**:
- Use **CLI Mode** with conservative scaling
- 2-3 developers in parallel
- Significant speedup without complexity

**For Large Projects (16+ stories)**:
- Use **CLI Mode** with aggressive scaling
- 3-5 developers in parallel
- Maximum throughput
- Requires good story independence

### Customizing Scaling (Advanced)

To customize scaling behavior, modify the scaling rules in `.claude/rules/orchestration-workflow.md`:

Look for the section: `## Scaling Rules`

**Conservative Scaling** (Default):
- Best for: Teams new to parallel execution
- Safer: Fewer merge conflicts
- Slower: But more predictable

**Aggressive Scaling**:
- Best for: Experienced teams, independent stories
- Faster: Maximum parallelism
- Riskier: More potential for conflicts

### Troubleshooting

**"Configuration Error" Message**:
- **Problem**: Neither `.claude/agents/` nor `/orchestration/prompts/` found
- **Solution**: Verify directories exist or reinstall using `install.bat` / `install.ps1`

**Agents Not Spawning in CLI Mode**:
- **Problem**: CLI mode detected but agents not spawning
- **Solution**:
  1. Verify Auggie CLI is installed: `auggie --version`
  2. Check agent configs exist: `ls .claude/agents/`
  3. Ensure agent files have proper frontmatter (name, description, model)

**Too Many Merge Conflicts**:
- **Problem**: Multiple developers causing conflicts
- **Solution**:
  1. Reduce max developers in scaling rules
  2. Improve story independence in planning phase
  3. Use feature branches per developer instance

## Parallel Execution (CLI Mode)

### How It Works

When using Auggie CLI, the orchestrator can spawn **multiple instances** of the same agent type to work in parallel:

**Example: 10 Stories**
```
[Orchestrator] 10 stories planned. Spawning 3 developers...

@developer-1 → Story #1: User Auth     }
@developer-2 → Story #2: Database      } Working in parallel
@developer-3 → Story #3: API Endpoints }

Each completes → @code-reviewer → @tester → Next story
```

### Scaling Rules

**Conservative Scaling (Default)**:
- 1-4 stories: 1 developer, 1 reviewer, 1 tester
- 5-9 stories: 2 developers, 2 reviewers, 2 testers
- 10+ stories: 3 developers, 3 reviewers, 3 testers

**Aggressive Scaling (Fast Mode)**:
- 3-5 stories: 2 developers
- 6-10 stories: 3 developers
- 11+ stories: 5 developers

**Maximum Limits**:
- Max 5 developers (prevents merge conflicts)
- Max 5 reviewers
- Max 5 testers

### Benefits

- ⚡ **3-5x faster** completion for large projects
- 🔄 **Parallel work** on independent stories
- ✅ **Quality maintained** - each story still goes through all gates
- 📊 **Dynamic scaling** - adapts to workload
- 🎯 **Work queue management** - optimal task distribution

### Requirements

- Auggie CLI installed
- `.claude/agents/` directory with agent configs
- Independent stories (no blocking dependencies)

## Best Practices

1. **Be Specific**: Include tech stack and features in your initial request
2. **Trust the Process**: Let each phase complete thoroughly
3. **One Story at a Time**: Complete, review, and test each story before moving to the next (or use parallel execution in CLI mode)
4. **Review Artifacts**: Check `/orchestration/artifacts/` for documentation
5. **Iterate**: The system automatically loops back when issues are found
6. **Separate Concerns**: Keep orchestration system files separate from project code
7. **Quality Gates**: Never skip code review or testing for any story
8. **Use CLI Mode for Large Projects**: 10+ stories benefit significantly from parallel execution
9. **Remove Unused Directories**: If using CLI mode, you can remove `/orchestration/prompts/` to avoid confusion

## Success Criteria

Projects are complete when:
- ✅ All acceptance criteria met
- ✅ Code builds without errors
- ✅ All tests passing (>80% coverage)
- ✅ Code review approved
- ✅ No critical bugs
- ✅ Documentation complete

---

**Version**: 1.1

*Transform complex development projects into manageable, high-quality deliverables through multi-agent collaboration.*

