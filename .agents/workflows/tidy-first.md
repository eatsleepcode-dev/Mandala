---
description: Kent Beck's Tidy First — structural tidyings separate from behavioural changes.
---

# Tidy First — data-platform

> *"Make the change easy, then make the easy change."* — Kent Beck

Separate **structural tidyings** (shape of code) from **behavioural changes** (what code does). One type per commit.

---

## Economics Filter (Run Before Any Tidy)

Answer all three before touching code:

| Question | If No → |
|---|---|
| Is this code likely to change again? | Do not tidy. Leave it. |
| Is the cost of tidying now less than the cost of the mess later? | Do not tidy. The mess is cheaper. |
| Is the future change imminent (not speculative)? | Do not tidy. Speculative tidying is waste. |

Near a deadline → **ship first, tidy later**.

---

## Phase 1: Identify Opportunities

### Run Complexity Baseline

```bash
# Radon Cyclomatic Complexity — find functions with CC > 10
radon cc src/notebooks/ -a -nc

# Radon Maintainability Index — find files with MI < 20 (critical)
radon mi src/notebooks/ -nc
```

### Find Most-Changed Files (Coupling Indicator)

```bash
git log --name-only --pretty=format: -n 100 | grep -v '^$' | sort | uniq -c | sort -rn | head -15
```

### AI-Assisted Tidy Scan Prompt

```
Review this code for Kent Beck tidying opportunities.

For each suggestion:
1. Name the move type: dead code / guard clause / explaining variable / explaining constant / explaining helper / chunk statements / normalise symmetries / reading order / cohesion order
2. Show before and after
3. Confirm no behaviour change occurs
4. Flag if irreversible — do not proceed without approval

Apply the NOT-TO-TIDY filter first:
- Is this code likely to change again?
- Is the tidy proportionate to the behaviour change it enables?
- Are we near a deadline?
If any filter fails, say so and stop.

Priority order: dead code → guard clauses → explaining moves → chunk statements → normalise symmetries → reading order → cohesion order → new interface (flag only, do not implement)

One move, one suggestion. Never combine a tidy with a behaviour change.
```

---

## Phase 2: Tidying Moves (Reference)

Apply **one at a time, one commit per move**.

### Move 1: Dead Code (Highest Leverage)

Delete unused functions, imports, commented-out blocks. Version control is the safety net — do not comment out, delete.

```python
# ❌ Before
# def old_get_format(obj):  # replaced by SourceFileFormat
#     return obj.get("FileFormat", "parquet")

# ✅ After — deleted
```

### Move 2: Guard Clauses

Replace nested conditionals with early returns.

```python
# ❌ Before
def ingest(obj):
    if obj:
        if obj.get("SyncType"):
            if source_id:
                return _do_ingest(obj, source_id)
    return None

# ✅ After
def ingest(obj):
    if not obj:
        return None
    if not obj.get("SyncType"):
        return None
    if not source_id:
        return None
    return _do_ingest(obj, source_id)
```

### Move 3: Explaining Variables

Extract complex expressions into named variables — especially SQL fragments.

```python
# ❌ Before
url = f"{conn_cfg.get('BaseUrl', '').rstrip('/')}/{(obj.get('RelativeUrl') or '').strip().lstrip('/') or object_name.lstrip('/')}"

# ✅ After
base_url    = conn_cfg.get("BaseUrl", "").rstrip("/")
relative_url = (obj.get("RelativeUrl") or "").strip()
url_path    = relative_url if relative_url else object_name
url         = f"{base_url}/{url_path.lstrip('/')}"
```

### Move 4: Normalise Symmetries

When two code paths do the same thing differently, make them identical.

```python
# ❌ Before — one path uses chr(39), another uses \'
sql1 = f"WHERE name = '{name.replace(chr(39), chr(39)*2)}'"
sql2 = f"WHERE col = '{val.replace(\"'\", \"''\")}'  "

# ✅ After — one pattern, everywhere
_esc = lambda s: s.replace(chr(39), chr(39) * 2)
sql1 = f"WHERE name = '{_esc(name)}'"
sql2 = f"WHERE col = '{_esc(val)}'"
```

---

## Strangler Fig Pattern (for major migrations)

Use this when replacing the Control Lakehouse with a new store (e.g. Fabric SQL DB):

1. Build the new path **side-by-side** with the old one
2. Route **one function** (e.g. `get_config()`) to the new store, leave rest on old
3. If it breaks → rollback is one function change
4. Once everything routes to new store → delete old code
5. One commit per re-route

**Never do a big-bang rip-and-replace.**

---

## Commit Convention

```
tidy: extract url_path explaining variable from run_rest_ingestion
tidy: delete old FileFormat dead code
tidy: guard clause refactor in _ingest_landing_to_bronze
```
