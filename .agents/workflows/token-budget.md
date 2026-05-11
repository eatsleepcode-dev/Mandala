---
description: Audit and reduce AI agent context/token usage — tool-agnostic checklist with per-tool mechanics for Claude Code, VS Code Copilot, and Gemini.
triggers:
  - "session getting expensive"
  - "context audit"
  - "compact before sprint"
  - "token budget"
  - "context window"
  - "reduce tokens"
---

# Token Budget Hygiene

**Vibe Mode**: GATEKEEPER

Run this before starting a new sprint, when a session has accumulated 10+ tool
calls, or when the AI starts losing track of earlier decisions.

Context cost comes from what the AI *carries*, not just what you *type*. The
biggest offenders are: prior sprint artefacts still in context, verbose tool
output, large always-loaded instruction files, and exploratory dead-ends.

---

## When to invoke

| Trigger | Action |
|---|---|
| Just closed a sprint | Run Step 3 (compact/reset) before starting the next one |
| Session has run 10+ tool calls | Run Steps 1–3 |
| AI is losing track of earlier decisions | Run Steps 1–4 |
| About to do expensive multi-file exploration | Run Step 5 first |
| CLAUDE.md / copilot-instructions.md recently updated | Run Step 6 |

---

## Step 1 — Identify what is consuming context

Before changing anything, find the actual offenders. Context waste is usually
invisible until you look.

**What to check:**

1. **Always-loaded instruction files** — `CLAUDE.md`, `copilot-instructions.md`,
   `.github/copilot-instructions.md`. These load on every turn.
   Count tokens: rough estimate is 1 token ≈ 4 chars.
   Target: keep each file under ~200 lines / ~6,000 tokens.

2. **Tool output carried in session** — large terminal outputs, full file reads,
   search result dumps. Each one rides along in every subsequent turn.

3. **Completed sprint artefacts** — task cards, CHANGELOG entries, commit
   messages already merged. Once committed, they do not need to live in context.

4. **Dead-end exploration paths** — files that were read during investigation but
   are not part of the solution. These add zero value after the decision is made.

**Tool-specific diagnostics:**

| Tool | How to check context |
|---|---|
| **Claude Code** | `/context` — shows what is loaded and its approximate size |
| **VS Code Copilot** | No direct command. Infer from session length. Start a new chat if the conversation has > 20 exchanges |
| **Gemini (AI Studio / Vertex)** | Check token counter in the UI. Gemini 2.0 Flash: 1M ctx. 2.5 Pro: 2M ctx — but cost scales with input length |

---

## Step 2 — Trim instruction files

If any always-loaded file exceeds 200 lines:

1. Move implementation guides, design history, and meeting notes **out** of the
   instruction file and into `docs/` or `.agents/`. Reference them by path.
2. Keep only: run commands, package manager choice, formatting rules, do-not-touch
   directories, and critical architectural constraints.
3. Replace long tables with links: e.g. replace the full sprint register table
   with `See .agents/SPRINT_REGISTER.md`.

Target for this repo:
- `CLAUDE.md` → ≤ 200 lines
- `.github/copilot-instructions.md` → ≤ 150 lines (loads on every Copilot turn)

---

## Step 3 — Compact / reset context

Run this **immediately after a sprint close** — before starting the next sprint.
Sprint artefacts (CHANGELOG, task card content, commit log) are now in git;
they do not need to ride along into the next session.

**Tool-specific mechanics:**

| Tool | How to compact |
|---|---|
| **Claude Code** | `/compact` — summarises session, keeps key decisions, drops noise. Run *proactively* while session is still healthy, not after hitting the context wall. A healthy-session summary is higher quality than a desperate-session summary |
| **VS Code Copilot** | Start a new chat. Paste a 3-5 line handoff note: current branch, last commit hash, next task. The conversation summary system handles the rest if configured |
| **Gemini** | Start a new conversation. For Gemini in Vertex AI with long context: use the system instruction to set project context rather than conversational history |

**Handoff note template (paste at start of new session):**

```
Branch: vnext | HEAD: {hash}
Last sprint: Sprint {N} — COMPLETE ({date})
Next task: {sprint title or gap-id}
Baseline tests: {N} passed, {N} skipped
Open TDs: {count} HIGH — see .agents/TECH_DEBT.md
```

---

## Step 4 — Switch model to match task complexity

Not every task needs the most capable (and expensive) model. Match model to task.

| Task type | Recommended model |
|---|---|
| Read a file, search for a symbol, rename a variable | Lightest available (Haiku / Flash / GPT-4o-mini) |
| Write tests, implement a single function, lint fix | Sonnet / Flash / GPT-4o |
| Multi-file architecture, complex debugging, ADR decisions | Opus / 2.5 Pro / o3 |
| Sprint planning, pre-mortem | Sonnet / Flash |

**Tool-specific mechanics:**

| Tool | How to switch model |
|---|---|
| **Claude Code** | `/model sonnet` or `/model haiku` |
| **VS Code Copilot** | Model picker in the chat input (bottom of chat panel) |
| **Gemini** | Model selector in AI Studio; or change `model:` in Vertex API call |

---

## Step 5 — Narrow scope before exploration

Before asking the AI to "look at the repo" or "find the issue", resolve:

1. **Which file?** Check `src/notebooks/`, `tests/`, `.agents/` explicitly.
2. **Which lines?** Use `grep_search` or `Select-String` to find the exact location
   before reading the full file. Pass `startLine`/`endLine` to `read_file`.
3. **Use the `Explore` subagent** (VS Code Copilot) for read-only searches.
   Its output stays in its own context; only the summary returns to the main thread.

**Before (expensive):**
> "Look through the auth code and find what's wrong."

**After (cheap):**
> "In `azure_deployment.py` lines 340–380, explain why `_probe_workspace_identity`
> returns False when `notebookutils` is importable."

---

## Step 6 — Keep tooling lean

Each connected integration (MCP servers, skills, memory files) adds overhead on
every turn through tool definitions and memory loading.

- Do not load skills speculatively. Invoke `tool_search` only when you need a
  specific capability.
- Remove MCP connections that are not used in the current sprint.
- Do not accumulate session memory files — clear stale ones after each sprint.

---

## Integration with sprint workflow

This skill hooks into two points in the standard sprint lifecycle:

### At `/build-sprint` — Phase 0.6 (context health check)
Before writing the task card, verify the session is starting clean:
- Previous sprint artefacts compacted / context reset ✅
- Instruction files within size targets ✅
- Model appropriate for planning task ✅

### At `/sprint-close` — Step 10 (post-close compact)
After the sprint close commit is pushed:
1. Note the HEAD commit hash
2. Compact / reset context using the handoff note template above
3. Start the next sprint in a fresh session

---

## Quick reference

```
BEFORE sprint:   check context → trim if needed → compact if prior sprint in context
DURING sprint:   exact file+line refs → Explore subagent for searches → -Last N on terminal output
AFTER sprint:    compact immediately → handoff note → fresh session
ALWAYS:          match model to task complexity
```
