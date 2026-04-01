# pi-interactive-subagents

Async subagents for [pi](https://github.com/badlogic/pi-mono) — spawn, orchestrate, and manage sub-agent sessions in multiplexer panes. **Fully non-blocking** — the main agent keeps working while subagents run in the background.

https://github.com/user-attachments/assets/30adb156-cfb4-4c47-84ca-dd4aa80cba9f

## How It Works

Call `subagent()` and it **returns immediately**. The sub-agent runs in its own terminal pane. A live widget above the input shows all running agents with elapsed time and progress. When a sub-agent finishes, its result is **steered back** into the main session as an async notification — triggering a new turn so the agent can process it.

```
╭─ Subagents ──────────────────────── 2 running ─╮
│ 00:23  Scout: Auth (scout)    8 msgs (5.1KB)   │
│ 00:45  Scout: DB (scout)     12 msgs (9.3KB)   │
╰─────────────────────────────────────────────────╯
```

For parallel execution, just call `subagent` multiple times — they all run concurrently:

```typescript
subagent({ name: "Scout: Auth", agent: "scout", task: "Analyze auth module" });
subagent({ name: "Scout: DB", agent: "scout", task: "Map database schema" });
// Both return immediately, results steer back independently
```

## Install

```bash
pi install git:github.com/Whamp/pi-interactive-subagents
```

Supported multiplexers:

- [cmux](https://github.com/manaflow-ai/cmux)
- [tmux](https://github.com/tmux/tmux)
- [zellij](https://zellij.dev)

Start pi inside one of them:

```bash
cmux pi
# or
tmux new -A -s pi 'pi'
# or
zellij --session pi   # then run: pi
```

Optional: set `PI_SUBAGENT_MUX=cmux|tmux|zellij` to force a specific backend.

## What's Included

### Extensions

**Subagents** — 4 tools + 3 commands:

| Tool              | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `subagent`        | Spawn a sub-agent in a dedicated multiplexer pane (async — returns immediately) |
| `subagents_list`  | List available agent definitions                                                |
| `set_tab_title`   | Update tab/window title to show progress                                        |
| `subagent_resume` | Resume a previous sub-agent session (async)                                     |

| Command                    | Description                          |
| -------------------------- | ------------------------------------ |
| `/plan`                    | Start a full planning workflow       |
| `/iterate`                 | Fork into a subagent for quick fixes |
| `/subagent <agent> <task>` | Spawn a named agent directly         |

**Session Artifacts** — 2 tools for session-scoped file storage:

| Tool             | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `write_artifact` | Write plans, context, notes to a session-scoped directory |
| `read_artifact`  | Read artifacts from current or previous sessions          |

### Bundled Agents

| Agent             | Model                        | Role                                                                                              |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| **planner**       | Opus (extended thinking)     | Takes a PRD, explores approaches, validates design, runs premortem, creates vertical slice work items |
| **scout**         | Gemini Flash                 | Fast read-only codebase reconnaissance — maps files, patterns, conventions                        |
| **worker**        | GLM 5.1                      | Implements tasks from GitHub Issues or Todos using TDD — writes code, runs tests, makes polished commits |
| **reviewer**      | Gemini Pro (high thinking)   | Autonomous code review for bugs, security issues, correctness                                     |
| **visual-tester** | Gemini Flash                 | Visual QA via Chrome CDP — screenshots, responsive testing, interaction testing                   |

Agent discovery follows priority: **project-local** (`.pi/agents/`) > **global** (`~/.pi/agent/agents/`) > **package-bundled**. Override any bundled agent by placing your own version in the higher-priority location.

---

## Async Subagent Flow

```
1. Agent calls subagent()         → returns immediately ("started")
2. Sub-agent runs in mux pane     → widget shows live progress
3. User keeps chatting             → main session fully interactive
4. Sub-agent finishes              → result steered back as interrupt
5. Main agent processes result     → continues with new context
```

Multiple subagents run concurrently — each steers its result back independently as it finishes. The live widget above the input tracks all running agents:

```
╭─ Subagents ──────────────────────── 3 running ─╮
│ 01:23  Scout: Auth (scout)      15 msgs (12KB) │
│ 00:45  Researcher (researcher)   8 msgs (6KB)  │
│ 00:12  Scout: DB (scout)             starting…  │
╰─────────────────────────────────────────────────╯
```

Completion messages render with a colored background and are expandable with `Ctrl+O` to show the full summary and session file path.

---

## Spawning Subagents

```typescript
// Named agent with defaults from agent definition
subagent({ name: "Scout", agent: "scout", task: "Analyze the codebase..." });

// Fork — sub-agent gets full conversation context
subagent({ name: "Iterate", fork: true, task: "Fix the bug where..." });

// Override agent defaults
subagent({
  name: "Worker",
  agent: "worker",
  model: "anthropic/claude-haiku-4-5",
  task: "Quick fix...",
});

// Custom working directory
subagent({ name: "Designer", agent: "game-designer", cwd: "agents/game-designer", task: "..." });
```

### Parameters

| Parameter      | Type    | Default  | Description                                                             |
| -------------- | ------- | -------- | ----------------------------------------------------------------------- |
| `name`         | string  | required | Display name (shown in widget and pane title)                           |
| `task`         | string  | required | Task prompt for the sub-agent                                           |
| `agent`        | string  | —        | Load defaults from agent definition                                     |
| `fork`         | boolean | `false`  | Copy current session for full context                                   |
| `model`        | string  | —        | Override agent's default model                                          |
| `systemPrompt` | string  | —        | Append to system prompt                                                 |
| `skills`       | string  | —        | Comma-separated skill names                                             |
| `tools`        | string  | —        | Comma-separated tool names                                              |
| `cwd`          | string  | —        | Working directory for the sub-agent (see [Role Folders](#role-folders)) |

---

## The `/plan` Workflow

The `/plan` command orchestrates a full planning-to-implementation pipeline, separating WHAT to build from HOW to build it.

```
/plan Add a dark mode toggle to the settings page
```

```
Phase 1: Scout            → Codebase reconnaissance
Phase 2: Grill-me         → Main session interviews user to build shared understanding
Phase 3: Write-a-PRD      → Produces a PRD (as GitHub Issue or local artifact)
Phase 4: Planner          → Interactive subagent figures out HOW, creates vertical slices
Phase 5: Execute          → Workers implement slices using TDD (AFK items autonomous, HITL flagged)
Phase 6: Review           → Reviewer subagent checks all changes
```

At the start of Phase 3, the workflow asks whether to track work as **GitHub Issues** (persistent, autonomous workers pick them up across sessions) or **Todos** (session-scoped, good for quick/offline work). Each vertical slice is tagged **AFK** (autonomous) or **HITL** (needs human decision).

Tab/window titles update to show current phase:

```
🔍 Investigating: dark mode → 🔥 Grilling: dark mode → 📝 PRD: dark mode
→ 💬 Planning: dark mode → 🔨 Executing: 1/3 → 🔎 Reviewing → ✅ Done
```

---

## The `/iterate` Workflow

For quick, focused work without polluting the main session's context.

```
/iterate Fix the off-by-one error in the pagination logic
```

This forks the current session into a subagent with full conversation context. Make the fix, verify it, and exit to return. The main session gets a summary of what was done.

---

## Custom Agents

Place a `.md` file in `.pi/agents/` (project) or `~/.pi/agent/agents/` (global):

```markdown
---
name: my-agent
description: Does something specific
model: anthropic/claude-sonnet-4-6
fallback-models: google/gemini-2.5-pro, zai/glm-5.1
thinking: minimal
tools: read, bash, edit, write
spawning: false
---

# My Agent

You are a specialized agent that does X...
```

### Frontmatter Reference

| Field         | Type    | Description                                                                                                                                                                                                                                                                 |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | string  | Agent name (used in `agent: "my-agent"`)                                                                                                                                                                                                                                    |
| `description` | string  | Shown in `subagents_list` output                                                                                                                                                                                                                                            |
| `model`       | string  | Default model (e.g. `anthropic/claude-sonnet-4-6`)                                                                                                                                                                                                                          |
| `fallback-models` | string | Comma-separated fallback models tried in order if the primary model fails with an API error (see [Fallback Models](#fallback-models))                                                                                                                                  |
| `thinking`    | string  | Thinking level: `minimal`, `medium`, `high`                                                                                                                                                                                                                                 |
| `tools`       | string  | Comma-separated **native pi tools only**: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`                                                                                                                                                                             |
| `skills`      | string  | Comma-separated skill names to auto-load                                                                                                                                                                                                                                    |
| `spawning`    | boolean | Set `false` to deny all subagent-spawning tools                                                                                                                                                                                                                             |
| `deny-tools`  | string  | Comma-separated extension tool names to deny                                                                                                                                                                                                                                |
| `auto-exit`   | boolean | Auto-shutdown when the agent finishes its turn — no `subagent_done` call needed. If the user sends any input, auto-exit is permanently disabled and the user takes over the session. Recommended for autonomous agents (scout, worker); not for interactive ones (planner). |
| `artifact-required` | boolean | When `true`, report a contract failure if the agent produces no artifact on completion |
| `artifact-name` | string | Expected logical artifact name (e.g., `context.md`). Omit for variable-name artifacts. |
| `cwd`         | string  | Default working directory (absolute or relative to project root)                                                                                                                                                                                                            |

---

### `auto-exit`

When set to `true`, the agent session shuts down automatically as soon as the agent finishes its turn — no explicit `subagent_done` call is needed.

**Behavior:**

- The session closes after the agent's final message (on the `agent_end` event)
- If the user sends **any input** before the agent finishes, auto-exit is permanently disabled for that session — the user takes over interactively
- The modeHint injected into the agent's task is adjusted accordingly: autonomous agents see "Complete your task autonomously." rather than instructions to call `subagent_done`

**When to use:**

- ✅ Autonomous agents (scout, worker, reviewer) that run to completion
- ❌ Interactive agents (planner, iterate) where the user drives the session

```yaml
---
name: scout
auto-exit: true
---
```

---

### Artifact Contract

Agent definitions can declare artifact requirements via frontmatter. When a subagent finishes, the framework validates its output against the declared contract and reports failures with recovery guidance.

```yaml
---
name: scout
artifact-required: true
artifact-name: context.md
---
```

**Frontmatter fields:**

| Field | Type | Description |
|-------|------|-------------|
| `artifact-required` | boolean | When `true`, the framework reports a contract failure if the agent exits without producing the expected artifact |
| `artifact-name` | string | Expected logical artifact name (e.g., `context.md`). Omit when the name is variable (e.g., planner outputs `plans/YYYY-MM-DD-<name>.md`). |

**How it works:**

1. A subagent runs and writes artifacts via `write_artifact`
2. On completion, the framework scans the run-scoped artifact directory
3. If `artifact-required: true` and no artifact exists, the steer message includes a contract failure with recovery guidance (resume instruction + expected `write_artifact` call)
4. If `artifact-name` is set and a different artifact was produced, the failure names the expected vs. actual artifacts

**Primary artifact handoff:** When a subagent produces exactly one artifact, it is automatically designated the primary. The completion message tells the orchestrator exactly which artifact name to pass to `read_artifact()`. Artifact contents are never auto-loaded — the orchestrator explicitly reads them.

**Bundled agent contracts:**

| Agent | `artifact-required` | `artifact-name` | Rationale |
|-------|--------------------|-----------------|-----------|
| scout | `true` | `context.md` | Always produces a context report |
| reviewer | `true` | `review.md` | Always produces a review |
| visual-tester | `true` | `visual-test-report.md` | Always produces a visual test report |
| planner | `true` | _(none)_ | Variable name (`plans/YYYY-MM-DD-<name>.md`) |
| worker | _(none)_ | _(none)_ | Artifact output is task-dependent |

### Fallback Models

When a model's API fails (overloaded, rate-limited, network errors, capacity issues), pi retries 3 times with exponential backoff. If all retries are exhausted and the subagent exits, `fallback-models` kicks in — the session is **resumed** with the next model in the list, preserving all conversation progress.

```yaml
---
name: worker
model: zai/glm-5.1
fallback-models: anthropic/claude-sonnet-4-6, google/gemini-2.5-pro
auto-exit: true
---
```

**How it works:**

1. Subagent starts with `model` (primary)
2. Pi's built-in retry handles transient errors (3 retries, exponential backoff)
3. If retries exhausted → session resumes with first `fallback-models` entry
4. If that also fails → next fallback, and so on
5. If all fallbacks exhausted → reports failure normally

**Key details:**

- Only triggers on **model API errors** (overloaded, rate limit, 429/500/502/503/504, network failures, timeouts). Task failures and user aborts do not trigger fallback.
- The session file is **resumed**, not relaunched — all prior work (tool calls, code written, commits made) is preserved.
- The `thinking` level from the agent definition carries over to fallback models.
- When `model` is explicitly overridden via the `subagent()` call's `model` parameter, fallback models are skipped (the caller chose a specific model).

---

## Tool Access Control

By default, every sub-agent can spawn further sub-agents. Control this with frontmatter:

### `spawning: false`

Denies all spawning tools (`subagent`, `subagents_list`, `subagent_resume`):

```yaml
---
name: worker
spawning: false
---
```

### `deny-tools`

Fine-grained control over individual extension tools:

```yaml
---
name: focused-agent
deny-tools: subagent, set_tab_title
---
```

### Recommended Configuration

| Agent      | `spawning`  | Rationale                                    |
| ---------- | ----------- | -------------------------------------------- |
| planner    | _(default)_ | Legitimately spawns scouts for investigation |
| worker     | `false`     | Should implement tasks, not delegate         |
| researcher | `false`     | Should research, not spawn                   |
| reviewer   | `false`     | Should review, not spawn                     |
| scout      | `false`     | Should gather context, not spawn             |

---

## Role Folders

The `cwd` parameter lets sub-agents start in a specific directory with its own configuration:

```
project/
├── agents/
│   ├── game-designer/
│   │   └── CLAUDE.md          ← "You are a game designer..."
│   ├── sre/
│   │   ├── CLAUDE.md          ← "You are an SRE specialist..."
│   │   └── .pi/skills/        ← SRE-specific skills
│   └── narrative/
│       └── CLAUDE.md          ← "You are a narrative designer..."
```

```typescript
subagent({ name: "Game Designer", cwd: "agents/game-designer", task: "Design the combat system" });
subagent({ name: "SRE", cwd: "agents/sre", task: "Review deployment pipeline" });
```

Set a default `cwd` in agent frontmatter:

```yaml
---
name: game-designer
cwd: ./agents/game-designer
spawning: false
---
```

---

## Tools Widget

Every sub-agent session displays a compact tools widget showing available and denied tools. Toggle with `Ctrl+J`:

```
[scout] — 12 tools · 4 denied  (Ctrl+J)              ← collapsed
[scout] — 12 available  (Ctrl+J to collapse)          ← expanded
  read, bash, edit, write, todo, ...
  denied: subagent, subagents_list, ...
```

---

## Requirements

- [pi](https://github.com/badlogic/pi-mono) — the coding agent
- One supported multiplexer:
  - [cmux](https://github.com/manaflow-ai/cmux)
  - [tmux](https://github.com/tmux/tmux)
  - [zellij](https://zellij.dev)

```bash
cmux pi
# or
tmux new -A -s pi 'pi'
# or
zellij --session pi   # then run: pi
```

Optional backend override:

```bash
export PI_SUBAGENT_MUX=cmux   # or tmux, zellij
```

## Credits

Forked from [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents) — thanks to [HazAT](https://github.com/HazAT) for the original project.

## License

MIT
