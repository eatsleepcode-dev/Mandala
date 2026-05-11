---
sprint: 10
title: "PIM control plane — Data Product Catalogue (GAP-10)"
gaps: [GAP-10]
effort: M
status: PLANNED
score_before: TBD
score_after_estimate: TBD
adr_required: [ADR-051]
branch: claude/new-session-Jgqbi
---

# Sprint 9 — PIM control plane (Data Product Catalogue)

## Goals

| Gap | Deliverable | Done when |
|-----|-------------|-----------|
| GAP-10 | ADR-051 — Data product catalog design (control plane extension vs external tool) | File committed before first implementation commit |
| GAP-10 | `control.DataProduct` DDL in `nb_bootstrap.py`, Fabric SQL `04-add-data-product.sql`, and SQLite stub | All three artefacts in same commit; test confirms each |
| GAP-10 | `nb_data_product_catalog.py` — `register_product`, `update_product`, `deprecate_product`, `find_products_by_domain` | CRUD tests green against SQLite stub; injection guard tested |
| GAP-10 | `config/seed-dev.json` — example `DataProduct` seed row | Seed integrity test green |

---

## TD Pre-flight

**TD-064 (High)** — live Fabric SQL commissioning — **open, out of scope for Sprint 9**.
Pre-existing carryover from Sprint 6. `DataProduct` CRUD is fully covered offline via
SQLite stub (`PEGGY_SQL_STUB=sqlite`). TD-064 covers the live commissioning path.

No other High TDs are targeted at Sprint 9.

---

## ADR pre-flight

ADR-051 must be written and committed before any implementation commits in this sprint.

| ADR | Topic | Status |
|-----|-------|--------|
| ADR-051 | Data product catalog design (control plane extension vs external tool) | MISSING — write first |

---

## GAP-10 — Data Product Catalogue — PIM control plane

### Notebook delivery order

1. **ADR-051** — committed first
2. **Cycle 1** — `control.DataProduct` DDL (Delta + Fabric SQL + SQLite stub)
3. **Cycle 2** — `register_product` + `update_product` CRUD + `_validate_object_ids`
4. **Cycle 3** — `deprecate_product` + `find_products_by_domain` with injection guard
5. **Cycle 4** — `config/seed-dev.json` example seed row

*Note: `create_control_tables` CC=16 assessed as a flat DDL sequence (not genuine branching).
No tidy cycle required — the CC is attributable to long DDL strings, not logic branches.*

### Key design decisions (pre-empt ADR-051 authoring)

- **Control-plane-first**: extend the existing Fabric SQL control plane (`nb_utils_fabric_sql.py`)
  rather than adopting a separate PIM tool. `DataProduct` is the linking entity that bridges
  `GoldObject`, `IngestionConfig`, and future OpenMetadata sync (GAP-11).
- **Dual DDL artefacts**: every new control table must land in both `nb_bootstrap.py` (Delta
  reference/migration history) and `config/control-schema/fabric-sql/` (production T-SQL).
  The SQLite stub in `nb_utils_fabric_sql._bootstrap_stub()` is also updated atomically.
- **`InputObjectIDs` / `OutputObjectIDs` as STRING**: comma-delimited IDs avoid array/JSON
  column portability issues across Delta and Fabric SQL. `_validate_object_ids` guards referential
  integrity at the application layer.
- **Injection guard**: `find_products_by_domain` applies `.replace(chr(39), chr(39)*2)` to the
  `domain` parameter. Explicitly tested with a single-quote domain string.
- **Migration to OpenMetadata** (GAP-11, Sprint 10): `DataProduct` is the canonical source
  of truth. OpenMetadata sync reads from it. No OpenMetadata dependency in this sprint.

### T-SQL DDL artefact

`config/control-schema/fabric-sql/04-add-data-product.sql` — contains the `CREATE TABLE
control.DataProduct` T-SQL DDL as documented in the task card Migration SQL section.

### TDD summary

| Cycle | Test class | Test methods |
|-------|-----------|--------------|
| 1 | `TestDataProductDDL` | `test_data_product_table_in_bootstrap_source` |
| 1 | `TestDataProductStub` | `test_data_product_table_in_sqlite_stub` |
| 2 | `TestRegisterProduct` | `test_register_product_inserts_row`, `test_register_product_rejects_invalid_object_ids` |
| 2 | `TestUpdateProduct` | `test_update_product_sets_updated_date` |
| 3 | `TestDeprecateProduct` | `test_deprecate_sets_is_active_false` |
| 3 | `TestFindProductsByDomain` | `test_find_returns_correct_domain_rows`, `test_domain_with_single_quote_does_not_raise` |
| 4 | `TestSeedIntegrity` | `test_seed_dev_has_data_product_example_row` |

---

## Definition of Done

- [ ] `pytest tests/test_nb_data_product_catalog.py -v` — all green
- [ ] `pytest tests/test_nb_utils_fabric_sql.py -k "DataProduct" -v` — all green
- [ ] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [ ] `gitleaks detect --verbose` — clean
- [ ] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [ ] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [ ] ADR-051 committed before first implementation commit
- [ ] `control.DataProduct` DDL in `nb_bootstrap.py`
- [ ] `config/control-schema/fabric-sql/04-add-data-product.sql` committed
- [ ] `_bootstrap_stub()` in `nb_utils_fabric_sql.py` includes `DataProduct` table
- [ ] SQL injection guard tested (`O'Brien` domain string)
- [ ] `_validate_object_ids` — invalid ID rejection tested
- [ ] Sprint register updated
- [ ] GAP-11 (Sprint 10) prerequisite: this sprint COMPLETE
