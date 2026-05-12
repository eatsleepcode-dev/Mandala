---
description: Vet a new Python/PySpark library before adding it to requirements-ci.txt or a Fabric custom environment. Run this before adding any new pip dependency to any sprint.
---

# Vet Library

**Vibe Mode**: CREATION (research + decision — no implementation code)

Produces a go/no-go decision and, if approved, the exact `requirements-ci.txt` line and any
Fabric environment notes needed. Run before adding any `pip install` to a notebook or requirements file.

---

## Inputs

| Input | Description |
|---|---|
| `library` | Package name as it appears on PyPI (e.g. `whylogs`, `pandera[pyspark]`) |
| `gap-id` | The sprint gap that needs this library (e.g. `GAP-07`) |

---

## Step 1 — Check if already present

```powershell
Select-String "{library}" requirements-ci.txt, requirements*.txt 2>$null
```

If it's already listed: note the pinned version and skip to Step 5.

---

## Step 2 — Fabric installability check

Answer these questions:

**Q1: Pure Python or requires native extensions / JARs?**
- Pure Python (no C extensions, no JARs): ✅ installable via `pip install` in Fabric notebook cell or custom environment
- Requires a JAR (e.g. PyDeequ needs Deequ JAR): ❌ requires a Fabric custom environment with the JAR bundled — significant ops overhead; document this constraint
- Requires C extensions that need a compiler: check if a pre-built wheel exists on PyPI for `linux/aarch64` (Fabric Spark nodes) — if not, requires custom environment

**Q2: Does it require a kernel restart after install?**
- Libraries that register entry points, modify `sys.modules`, or have C extensions typically need a restart
- Pure Python packages that don't hook into the interpreter at import time usually do not
- If unsure: note "kernel restart required" in the task card

**Q3: Is it Fabric-session-installable (no persistent environment)?**
- Lightweight pure Python packages can be installed per-session: `%pip install {library}=={version}` at the top of the notebook
- Heavier packages or those with side-effects should go in a Fabric custom environment

---

## Step 3 — License check

```powershell
# Check PyPI metadata
Invoke-RestMethod "https://pypi.org/pypi/{library}/json" | Select-Object -ExpandProperty info | Select-Object license, home_page, version
```

Approved licenses: **MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, PSF**
Requires legal review: LGPL, GPL, MPL, EUPL, SSPL, proprietary
If not an approved license: **stop — raise with the team before proceeding**

---

## Step 4 — Security check

```powershell
# Check for known vulnerabilities (requires pip-audit)
pip-audit --requirement requirements-ci.txt --dry-run 2>$null
# Or check manually via OSV:
Invoke-RestMethod "https://api.osv.dev/v1/query" -Method Post -Body (@{package=@{name="{library}";ecosystem="PyPI"}} | ConvertTo-Json) -ContentType "application/json"
```

If HIGH/CRITICAL CVEs exist on the current release: do not add. Pin to an older safe version only if the gap cannot proceed without it, and raise a TD immediately.

---

## Step 5 — Pin the version

```powershell
# Find latest stable version
(Invoke-RestMethod "https://pypi.org/pypi/{library}/json").info.version
```

Pin to the exact version: `{library}=={version}` — never use `>=` or unpinned in requirements-ci.txt.

For extras (e.g. `pandera[pyspark]`): pin as `pandera[pyspark]=={version}`.

---

## Step 6 — requirements-ci.txt update

Add the pinned line to `requirements-ci.txt` in alphabetical order within its section.
If no section exists for the sprint's category (profiling, DQ, catalog, etc.), add an inline comment:

```
# Sprint 8 — Bronze profiling (GAP-07)
whylogs==1.3.27
```

---

## Step 7 — Import guard (if Fabric-only)

If the library is only available in a Fabric runtime (not locally installable without pip), add an import guard in the notebook:

```python
try:
    import {library_module}
except ImportError:
    {library_module} = None  # offline / CI — skip Fabric-only features
```

This keeps all tests passing locally without the full Fabric environment.

---

## Step 8 — Decision record

Add a brief note to the relevant task card (`.mandala/inbox/__todo/{date}/task-{gap-id}.md`) under a `## Library Vetting` section:

```markdown
## Library Vetting

| Library | Version | License | Fabric install | Kernel restart | Notes |
|---|---|---|---|---|---|
| {library} | {version} | {license} | session / env | yes / no | {notes} |
```

---

## Go / No-Go summary

| Check | Result |
|---|---|
| Already in requirements | Yes / No |
| Fabric installable | ✅ / ❌ (JAR required) / ⚠️ (custom env) |
| License approved | ✅ / ❌ (requires review) |
| No HIGH CVEs | ✅ / ❌ (block) |
| Version pinned | ✅ |
| Import guard needed | Yes / No |

**If all checks are ✅: proceed to update `requirements-ci.txt` and the task card.**
**If any check is ❌: stop and resolve before adding the dependency.**
