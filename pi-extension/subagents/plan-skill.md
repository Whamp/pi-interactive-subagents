---
name: plan
description: >
  Planning workflow. Grills the user on intent, writes a PRD, then spawns a
  planner to figure out HOW and create work items. Use when asked to "plan",
  "brainstorm", "I want to build X", or "let's design". Requires the
  subagents extension and a supported multiplexer (cmux/tmux/zellij).
---

# Plan

A planning workflow that separates WHAT (grill-me + write-a-prd) from HOW (planner). You build shared understanding with the user, produce a PRD, then a planner subagent figures out the technical approach and creates work items.

**No implementation before a PRD exists. No exceptions.**

## Workflow Overview

```
Phase 1: Grill (you are HERE — start immediately)
    ↓
Phase 2: Write-a-PRD (main session — produces PRD)
    ↓
Phase 3: Planner (subagent, interactive — figures out HOW)
    ↓
Phase 4: Execute (workers with mandatory TDD)
    ↓
Phase 5: Review
```

---

## Tab Titles

Use `set_tab_title` to keep the user informed of progress. Update at every phase transition.

| Phase     | Title example                                                  |
| --------- | -------------------------------------------------------------- |
| Grilling  | `🔥 Grilling: <short task>`                                    |
| PRD       | `📝 PRD: <short task>`                                         |
| Planning  | `💬 Planning: <short task>`                                    |
| Executing | `🔨 Executing: 1/3 — <short task>` (update counter per worker) |
| Reviewing | `🔎 Reviewing: <short task>`                                   |
| Done      | `✅ Done: <short task>`                                        |

---

## Phase 1: Grill — START NOW

Set the tab title to `🔥 Grilling: <short task>` and begin immediately.

Interview the user relentlessly about every aspect of what they want to build. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead of asking. Use `read`, `bash`, `grep`, `find` to orient yourself as needed — there is no separate scout phase.

**Do not move to Phase 2 until you and the user have shared understanding of what to build.**

When you have no more questions and all branches are resolved, ask:

> "I've covered everything I need. Ready to write the PRD?"

Wait for the user to confirm before proceeding.

---

## Phase 2: Write-a-PRD

Set the tab title to `📝 PRD: <short task>`.

Load the write-a-prd skill:

```
/skill:write-a-prd
```

**Before beginning the PRD process, ask the user:**

> "Should we track work as **GitHub Issues** (persistent, autonomous workers can pick them up across sessions) or **Todos** (session-scoped, good for quick/offline work)?"

Remember their choice — it flows to the planner in Phase 3.

**Since grilling already ran, skip Step 3 of write-a-prd** (the interview step). The shared understanding is already built. Proceed directly to:

1. Explore the repo to verify assertions (if not already done during grilling)
2. Sketch major modules — look for deep modules that can be tested in isolation
3. Write the PRD using the template, adding:
   - **ISC section** — atomic, binary, testable success criteria
   - **Effort level** — prototype / MVP / production / critical
4. Output the PRD:
   - **Issues path:** Submit as a GitHub Issue
   - **Todos path:** Write as a local artifact via `write_artifact`

---

## Phase 3: Planner

Set the tab title to `💬 Planning: <short task>`.

Spawn the interactive planner subagent. Pass it the PRD reference and the chosen output format.

```typescript
subagent({
  name: "💬 Planner",
  agent: "planner",
  interactive: true,
  task: `Plan implementation for PRD: [GitHub Issue #N or artifact path]

Output format: [Issues / Todos]

Context from investigation:
[paste relevant findings from grilling phase]`,
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

## Phase 4: Execute

Set the tab title to `🔨 Executing: 1/N — <short task>`.

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

### Execution Order HITL Can be blocking

**AFK items** — these can run autonomously. **HITL items** are flagged for the user.

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

## Phase 5: Review

Set the tab title to `🔎 Reviewing: <short task>`.

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

## Completion Checklist

Before reporting done:

1. ✅ All AFK work items closed?
2. ✅ All HITL items resolved?
3. ✅ Every item has a polished commit (using the `commit` skill)?
4. ✅ TDD was used for all implementations?
5. ✅ Reviewer has run?
6. ✅ Reviewer findings triaged and addressed?
7. ✅ ISC items verified (if the PRD included them)?
