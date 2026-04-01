---
name: plan
description: >
  Planning workflow. Grills the user on intent, writes a PRD, then spawns a
  planner to figure out HOW and create work items. Use when asked to "plan",
  "brainstorm", "I want to build X", or "let's design". Requires the
  subagents extension and a supported multiplexer (cmux/tmux/zellij).
---

# Plan

A planning workflow that separates WHAT (grill-me + write-a-prd) from HOW (planner). The main session builds shared understanding with the user, then a planner subagent figures out the technical approach and creates work items.

**Announce at start:** "Let me investigate first, then we'll nail down exactly what we're building."

---

## Tab Titles

Use `set_tab_title` to keep the user informed of progress in the multiplexer UI. Update the title at every phase transition.

| Phase         | Title example                                                  |
| ------------- | -------------------------------------------------------------- |
| Investigation | `🔍 Investigating: <short task>`                               |
| Grilling      | `🔥 Grilling: <short task>`                                    |
| PRD           | `📝 PRD: <short task>`                                         |
| Planning      | `💬 Planning: <short task>`                                    |
| Review plan   | `📋 Review: <short task>`                                      |
| Executing     | `🔨 Executing: 1/3 — <short task>` (update counter per worker) |
| Reviewing     | `🔎 Reviewing: <short task>`                                   |
| Done          | `✅ Done: <short task>`                                        |

Name subagents with context too:

- Scout: `"🔍 Scout"` (default is fine)
- Planner: `"💬 Planner"`
- Workers: `"🔨 Worker 1/3"`, `"🔨 Worker 2/3"`, etc.
- Reviewer: `"🔎 Reviewer"`

---

## The Flow

```
Phase 1: Scout (codebase reconnaissance)
    ↓
Phase 2: Grill-me (main session — builds shared understanding)
    ↓
Phase 3: Write-a-PRD (main session — produces PRD)
    ↓
Phase 4: Planner (subagent, interactive — figures out HOW)
    ↓
Phase 5: Execute (workers with mandatory TDD)
    ↓
Phase 6: Review
```

---

## Phase 1: Scout

Before grilling the user, orient yourself on the codebase.

**Quick look (small/familiar codebases):**

```bash
ls -la
find . -type f -name "*.ts" | head -20  # or relevant extension
cat package.json 2>/dev/null | head -30
```

**Deep scout (large/unfamiliar codebases):**

```typescript
subagent({
  name: "Scout",
  agent: "scout",
  interactive: false,
  task: "Analyze the codebase. Map file structure, key modules, patterns, and conventions. Summarize findings concisely.",
});
```

Read the scout's context artifact before proceeding.

---

## Phase 2: Grill-me

**This happens in the main session — not a subagent.** The shared understanding built here is the foundation for everything downstream.

Load the grill-me skill:

```
/skill:grill-me
```

Interview the user relentlessly about every aspect of what they want to build. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead of asking.

**Do not move to Phase 3 until you and the user have shared understanding of what to build.**

---

## Phase 3: Write-a-PRD

**This also happens in the main session.** The shared context from grill-me is in the conversation — don't lose it by delegating to a subagent.

Load the write-a-prd skill:

```
/skill:write-a-prd
```

**Before beginning the PRD process, ask the user:**

> "Should we track work as **GitHub Issues** (persistent, autonomous workers can pick them up across sessions) or **Todos** (session-scoped, good for quick/offline work)?"

Remember their choice — it flows to the planner in Phase 4.

**Since grill-me already ran, skip Step 3 of write-a-prd** (the interview step). The shared understanding is already built. Proceed directly to:

1. Explore the repo to verify assertions (if not already done via scout)
2. Sketch major modules — look for deep modules that can be tested in isolation
3. Write the PRD using the template, adding:
   - **ISC section** — atomic, binary, testable success criteria (from spec philosophy)
   - **Effort level** — prototype / MVP / production / critical
4. Output the PRD:
   - **Issues path:** Submit as a GitHub Issue
   - **Todos path:** Write as a local artifact via `write_artifact`

---

## Phase 4: Planner

Spawn the interactive planner subagent. Pass it the PRD reference and the chosen output format.

```typescript
subagent({
  name: "💬 Planner",
  agent: "planner",
  interactive: true,
  task: `Plan implementation for PRD: [GitHub Issue #N or artifact path]

Output format: [Issues / Todos]

Context from investigation:
[paste relevant findings from Phase 1]`,
});
```

**The user works with the planner in the subagent.** The planner will:
- NOT re-clarify requirements — that's already done
- Identify durable architectural decisions
- Explore approaches, validate design
- Run a premortem (risk analysis)
- Create vertical slices as GitHub Issues or Todos (HITL/AFK tagged)

When done, the user presses Ctrl+D and the plan + work items are returned.

---

## Phase 5: Execute

Once the planner closes, review the work items:

**Issues path:**
```bash
gh issue list --label "<prd-label>"
```

**Todos path:**
```
todo(action: "list")
```

Review with the user:
> "Here's what the planner produced: [brief summary]. Ready to execute, or anything to adjust?"

### Execution Order

**AFK items first** — these can run autonomously. **HITL items** are flagged for the user.

Spawn a scout first for implementation context, then workers sequentially:

```typescript
// 1. Scout gathers implementation context
subagent({
  name: "Scout",
  agent: "scout",
  interactive: false,
  task: "Gather context for implementing [feature]. Read the plan at [plan path]. Identify all files that will be created/modified, map existing patterns and conventions.",
});

// 2. Workers execute AFK items sequentially
subagent({
  name: "🔨 Worker 1/N",
  agent: "worker",
  interactive: false,
  task: "Implement [Issue #N / TODO-xxxx]. Use TDD. Plan: [plan path]\n\nScout context: [paste scout summary]",
});
```

**Always run workers sequentially in the same git repo** — parallel workers will conflict on commits.

**If a worker reports missing context** (rejects the task), provide the missing information and re-spawn.

**HITL items:** Present to the user for decision, then spawn a worker once resolved.

---

## Phase 6: Review

After all work items are complete:

```typescript
subagent({
  name: "🔎 Reviewer",
  agent: "reviewer",
  interactive: false,
  task: "Review the recent changes. Plan: [plan path]",
});
```

Triage findings:

- **P0** — Real bugs, security issues → fix now
- **P1** — Genuine traps, maintenance dangers → fix before merging
- **P2** — Minor issues → fix if quick, note otherwise
- **P3** — Nits → skip

Create work items for P0/P1, run workers to fix, re-review only if fixes were substantial.

---

## ⚠️ Completion Checklist

Before reporting done:

1. ✅ All AFK work items closed?
2. ✅ All HITL items resolved?
3. ✅ Every item has a polished commit (using the `commit` skill)?
4. ✅ TDD was used for all implementations?
5. ✅ Reviewer has run?
6. ✅ Reviewer findings triaged and addressed?
7. ✅ ISC items verified (if the PRD included them)?
