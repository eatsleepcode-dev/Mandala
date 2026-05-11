---
sprint: 16
title: "Gold Domain Framework — write_gold() standardisation + client-extension scaffold"
feature_plan_phase: 5
effort: L + S
status: COMPLETE
completed_date: 2026-05-06
score_before: 1266
score_actual: 1284
adr_required: []
branch: vnext
commits: "f381166…f07f136"
carryover: []
tds_raised: []
tds_closed: []
prerequisite: Sprint 13 COMPLETE (nb_catalog_sync.py Gold sync needed by domain scaffold)
---

# Sprint 16 — Gold Domain Framework (FEATURE_PLAN Phase 5)

## Goals

Enable domain-driven Gold layer development with scaffold-and-go tooling. A new Gold domain is
fully scaffolded (notebook stubs + RunbookStep rows) in under 5 minutes.

**Architecture note (updated):** Gold domain notebooks are client-specific, not core. The vnext
genericisation commit (`04176df`) removed all BFL-domain Gold notebooks, leaving
`nb_gold_orchestrator.py` as a generic core stub. Generated notebooks must target
`src/clients/{ClientName}/` (the ADR-031 client extension point), not `src/notebooks/`.

| Item | Deliverable | Done when |
|---|---|---|
| P6-B | `write_gold()` standardisation in `nb_utils_processing.py` | All modes (overwrite/merge/append); row count logged; consistent signature across all Gold notebooks |
| Template | `templates/nb_gold_domain_table_template.py` | Template file exists; domain scaffold uses it; output path tokens correct |
| P6-A | `nb_domain_scaffold.py` — Gold domain scaffold notebook | 4 steps; generates stub to `src/clients/{ClientName}/`; inserts RunbookStep rows |

---

## Pre-flight notes

**`nb_gold_orchestrator.py`** — exists as a generic stub. Sprint 16 leaves it unchanged.

**`nb_gold_candidate_detection.py`** — exists; Sprint 16 calls it from wizard Step 2 (fact/dimension
detection). No changes to the detection notebook itself.

**`write_gold()` in `nb_utils_processing.py`** — review existing implementation before Sprint 16
starts to identify the delta between current state and the P6-B target signature.

**Client extension point** — `src/clients/{client}/` is the ADR-031 model for client-specific
notebooks. The build pipeline composes `src/core` + `src/clients/<client>` into a staging directory
before pushing to the Deploy repo. Generated Gold notebooks belong here, not in `src/notebooks/`
(which is core only and gets shipped to every client unchanged).

**`nb_domain_scaffold.py` is Layer 1** — it runs inside Fabric, writes files, and inserts
RunbookStep rows. It is an operator utility notebook, not a Hub plugin. It is invoked by an operator
once per new domain; it does not need to be a persistent UI widget.

---

## Delivery order

### write_gold() standardisation

1. **Tidy** — read current `write_gold` in `nb_utils_processing.py`; identify callers; record
   baseline test count
2. **Cycle 1** — standardise signature:
   `write_gold(df, gold_lh, table_name, write_mode="overwrite", pk_columns=None)`
   with `merge` (incremental by `pk_columns`) and `append` modes
3. **Cycle 2** — `log_event` call after write with `sink_row_count`; uses Sprint 14 logging fields

### templates/nb_gold_domain_table_template.py

4. **Cycle 3** — create `templates/` directory; write template with standard cells:
   - Header / stage / description cells
   - `%%configure` cell (VL config)
   - Parameters cell: `PipelineRunId`, `SilverLakehouse`, `GoldLakehouse`
   - `%run ./nb_utils_config` cell
   - Read Silver section (`# TODO: Read from {source_table}`)
   - Transform placeholder (`# TODO: Add business logic here`)
   - `write_gold(df, gold_lh, "{target_table}", write_mode="{write_mode}")` call

### nb_domain_scaffold.py

5. **Cycle 4** — Step 1: domain definition; accepts `ClientName`, `DomainName`, source Silver
   tables list, target Gold lakehouse name
6. **Cycle 5** — Step 2: fact/dimension detection; calls `nb_gold_candidate_detection` inline;
   user confirms classifications before proceeding
7. **Cycle 6** — Step 3: scaffold generation
   - Read `templates/nb_gold_domain_table_template.py`
   - Replace `{CLIENT}`, `{DOMAIN}`, `{TABLE}`, `{source_table}`, `{target_table}`,
     `{classification}`, `{write_mode}` placeholders
   - Write to `src/clients/{ClientName}/nb_gold_{domain}_{table}.py` (not `src/notebooks/`)
   - Insert `RunbookStep` rows with `IsActive=False`
8. **Cycle 7** — Step 4: semantic model stub; generate
   `src/clients/{ClientName}/SemanticModels/{DomainName}/README.md` placeholder
9. **Cycle 8** — `run_domain_scaffold` orchestrator; `DryRun=True` mode previews file list and
   RunbookStep rows without writing; validates `ClientName` is non-empty before writing

---

## TDD summary

| Cycle | Test class | Key test methods |
|---|---|---|
| Tidy | — | structural only |
| 1 | `TestWriteGold` | `test_overwrite_mode`, `test_merge_mode_uses_pk`, `test_append_mode` |
| 2 | `TestWriteGold` | `test_log_event_called_with_sink_row_count` |
| 3 | `TestGoldTemplate` | `test_template_file_exists`, `test_template_has_parameters_cell` |
| 4 | `TestDomainScaffoldStep1` | `test_client_name_required`, `test_domain_name_required`, `test_silver_tables_list_accepted` |
| 5 | `TestDomainScaffoldStep2` | `test_candidate_detection_called_with_silver_tables` |
| 6 | `TestDomainScaffoldStep3` | `test_stub_notebook_written_to_clients_dir`, `test_placeholder_replaced`, `test_runbook_step_inserted_for_each_notebook` |
| 7 | `TestDomainScaffoldStep4` | `test_semantic_model_placeholder_created_in_clients_dir` |
| 8 | `TestRunDomainScaffold` | `test_dry_run_does_not_write_files`, `test_dry_run_returns_preview_list`, `test_empty_client_name_raises` |

Key test assertion change from original plan — Cycle 6 tests:

```python
# OLD (wrong)
assert "src/notebooks/nb_gold_sales_orders.py" in written_paths

# NEW (correct)
assert "src/clients/acme/nb_gold_sales_orders.py" in written_paths
```

---

## Key design decisions

- **`src/clients/{ClientName}/` is the output target** — not `src/notebooks/`. Core notebooks are
  client-agnostic; Gold domain notebooks are always client-specific. ADR-031 defines
  `src/clients/{client}/` as the extension point composed at CI time.
- **`ClientName` parameter is mandatory** — `run_domain_scaffold` raises `ValueError` if
  `ClientName` is empty or `None`. Prevents accidental writes to wrong path.
- **Template substitution is string-based** — no Jinja2. Python `str.replace()` on `{DOMAIN}`
  etc. is sufficient. Avoids adding external packages to the Fabric session.
- **Generated notebooks are Jupytext `.py`** — written in percent-format, not `.ipynb`. CI builds
  them to workspace items via `build_notebooks.py` exactly like core notebooks.
- **`RunbookStep` rows are inserted with `IsActive=False`** — operator activates after reviewing
  the generated notebook and confirming business logic is complete.
- **`nb_domain_scaffold.py` stays in `src/notebooks/`** — it is a core operator utility, runs
  identically for every client, and receives `ClientName` as a parameter. It is not client-specific.

---

## Control table / DDL changes

None required. Uses existing `RunbookStep` and `ObjectConfig` tables.

---

## Definition of Done

- [ ] `pytest tests/test_nb_domain_scaffold.py -v` — all green
- [ ] `pytest tests/test_nb_utils_processing.py -k "WriteGold" -v` — all green
- [ ] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [ ] `gitleaks detect --verbose` — clean
- [ ] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [ ] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [ ] `templates/nb_gold_domain_table_template.py` created; no `src/notebooks/` output path in template
- [ ] `write_gold()` signature standardised; all existing Gold notebook callers updated
- [ ] `test_stub_notebook_written_to_clients_dir` asserts `src/clients/{client}/` path
- [ ] Sprint register updated
