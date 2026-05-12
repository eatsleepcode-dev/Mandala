---
description: End-to-end sprint lifecycle — PLAN → TICKET → BUILD → GATE → CLOSE
---

# Sprint Playbook — data-platform

> 5 phases: PLAN → TICKET → BUILD → GATE → CLOSE

---

## Phase 1: PLAN

1. Pick the change from `ROADMAP.md` or `TECH_DEBT.md`
2. **Optional but recommended for larger/ambiguous gaps:** run `/user-story-map GAP-NN` first.
  Produces `.mandala/inbox/__todo/{YYYYMMDD}/story-map-{gap-id}.md` with:
   - Jeff Patton backbone (who does what, in narrative order)
   - Toyota Kata Challenge + Current Condition + Target Condition
   - Walking skeleton (scope of the first sprint)
   The Target Condition from the story map feeds directly into `/build-sprint` Step 0.5.
3. Create a task card: run `/build-sprint GAP-NN` (or fill `task-init.md` manually).
4. Run `/pre-mortem` — identify elephants before writing any code
5. Write the live DEV migration SQL in the task card before touching any code

---

## Phase 2: TICKET

Fill in the task card:

- Status → IN PROGRESS
- All elephants documented with strategies
- Live DEV SQL written
- Gate checklist items customised for this change

---

## Phase 3: BUILD — TDD Execution

**Before the first RED cycle — Tidy opportunity check:**

```bash
radon cc src/notebooks/{notebook}.py -nc   # CC > 10 on a function you're changing?
```

If yes and the task card has a Tidy Cycle entry: execute it first (one move, one commit).
If no tidy cycle in the card but CC > 10: apply the `/tidy-first` economics filter — tidy only if the change is imminent and proportionate. Deadline near → skip and raise a TD.

For each function:

1. 🔴 **RED**: Write failing test → `pytest tests/ -v` (must FAIL)
2. 🟢 **GREEN**: Minimal implementation → `pytest tests/ -v` (must PASS)
3. 🔵 **REFACTOR**: Clean + sniff test
4. **COMMIT**: `git commit -m "feat(nb-conn-rest): DataKey guard for CURSOR mode [GREEN]"`

Rules:
- Never skip RED
- Commit per TDD cycle
- If test fails **2 times in a row** after fixes → stop, run `/pre-mortem`
- Run AST check after every significant edit:
  ```bash
  python -c "
  import ast, re, pathlib
  for f in pathlib.Path('src/notebooks').rglob('*.py'):
      src = re.sub(r'^%.*$', '', f.read_text(), flags=re.MULTILINE)
      try: ast.parse(src); print('OK  ' + f.name)
      except SyntaxError as e: print(f'ERR {f.name} L{e.lineno}: {e.msg}')
  "
  ```

---

## Phase 4: GATE — Quality Verification

Run `/quality-gates` for the full command reference. Summary below.

### Mandatory (must all pass before merge)

```bash
# Secrets first
gitleaks detect --verbose

# Security
bandit -r src/ -ll -f text

# Lint (bugbear, security, complexity)
ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607

# Type check
mypy src/notebooks/ --ignore-missing-imports --no-strict-optional

# Tests + coverage (≥ 80% required)
pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v

# AST syntax check
python -c "
import ast, re, pathlib
for f in pathlib.Path('src/notebooks').rglob('*.py'):
    src = re.sub(r'^%.*$', '', f.read_text(), flags=re.MULTILINE)
    try: ast.parse(src); print('OK  ' + f.name)
    except SyntaxError as e: print(f'ERR {f.name} L{e.lineno}: {e.msg}')
"
```

### Roast Session (new chat)

Open a fresh conversation and run `/roast` against the most complex changed function.

Reference: `.agents/workflows/roast.md`

---

## Phase 5: CLOSE

Run `/sprint-close sprint-N` — it handles everything below automatically.

- [ ] All gates passed and documented in task card
- [ ] Live DEV migration SQL run (if schema change)
- [ ] Task card Status → COMPLETE
- [ ] `.agents/SPRINT_REGISTER.md` updated — sprint marked COMPLETE, next sprint unblocked
- [ ] Carryover items added to next sprint plan (or raised as TD if not next sprint)
- [ ] Resolved TDs closed in `.agents/TECH_DEBT.md`
- [ ] New TDs raised for anything deferred
- [ ] Commit: `git commit -m "chore: sprint N close — [feature name]; score X → Y"`

---

## Quick Reference

| Workflow | File | Slash command |
|---|---|---|
| **Sprint register** | `.agents/SPRINT_REGISTER.md` | — (read directly) |
| **Story map** | `.agents/workflows/user-story-map.md` | `/user-story-map GAP-NN` |
| **Build sprint** | `.agents/workflows/build-sprint.md` | `/build-sprint GAP-NN` |
| **Run sprint** | `.agents/workflows/run-sprint.md` | `/run-sprint GAP-NN` |
| **Sprint close** | `.agents/workflows/sprint-close.md` | `/sprint-close sprint-N` |
| **Tech debt** | `.agents/workflows/tech-debt.md` | `/tech-debt raise\|close\|query` |
| Task card | `.agents/workflows/task-init.md` | — (template) |
| Pre-mortem | `.agents/workflows/pre-mortem.md` | `/pre-mortem` |
| TDD | `.agents/workflows/tdd.md` | `/tdd` |
| Sniff test | `.agents/workflows/sniff-test.md` | `/sniff-test` |
| Tidy First | `.agents/workflows/tidy-first.md` | `/tidy-first` |
| Roast | `.agents/workflows/roast.md` | `/roast` |
| Quality gates | `.agents/workflows/quality-gates.md` | `/quality-gates` |
