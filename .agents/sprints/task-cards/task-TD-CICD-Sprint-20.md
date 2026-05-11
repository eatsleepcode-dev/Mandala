---
sprint_id: TD-CICD-Sprint-20
sprint: Sprint 20 (Phase 4)
status: CARRYOVER
adr_required: NOT REQUIRED
---

# Task: Tech Debt — CI/CD Quality Gates (Sprint 20 Phase 4)

**Status**: CARRYOVER
**Vibe Mode**: HARDENING
**Branch**: `vnext`
**Sprint**: Sprint 20 — Phase 4 (CI/CD)
**Effort**: 1–2 hrs (low-touch, high-impact)
**Score impact**: +5 pts (Prevents regression; enables automated compliance)

**TDs in scope**: TD-065, TD-066

---

## Context (The Elephants 🐘)

### 1. **TD-065 — pytest coverage gate missing from CI/CD** (1 hr, LOCAL)

**Problem**: `azure-pipelines.yml` `Build_And_Test` stage runs 1488 tests but does NOT enforce coverage threshold.
- Coverage can drop below 80% without blocking PR merge
- No automated gate prevents low-quality PRs
- Violates quality standard: "≥80% coverage required" (stated in CONTRIBUTING.md)

**Strategy**:
- Add `pytest --cov=src/notebooks --cov-fail-under=80` to `Build_And_Test` stage
- Generate coverage report: `--cov-report=term-missing` (shows which lines uncovered)
- Add to pipeline after `pytest tests/ -v` runs
- Document threshold + waiver process in CONTRIBUTING.md

**Implementation**:
```yaml
# In azure-pipelines.yml Build_And_Test stage:
- task: Bash@3
  displayName: 'Run pytest with coverage gate'
  inputs:
    targetType: 'inline'
    script: |
      python -m pytest tests/ \
        --cov=src/notebooks \
        --cov-report=term-missing \
        --cov-fail-under=80 \
        -v
```

**Status**: 🔲 Ready (one-liner addition + documentation)

---

### 2. **TD-066 — ADO approval gate between Dev → UAT** (XS config, PARKED ✋)

**Problem**: CI/CD pipeline auto-promotes Dev → UAT without approval.
- Risk: Untested code in UAT without human review
- ADO requires manual gate configuration (not code change)

**Strategy**:
- **PARKED** (2026-05-11): ADO portal configuration outside CI pipeline scope
- **Recommendation**: Create as separate ADO work item; defer to later sprint
- **Owner**: Azure DevOps admin (not developer task)

**Status**: 🟡 **PARKED** — Mark as backlog item for Ops team

---

## Recommended Sequence

### Standalone (can run anytime)
```
1. TD-065 (1 hr) — add pytest coverage gate
   ↓
   Commit: "ci(pipeline): add pytest coverage gate to Build_And_Test stage"
```

### If time permits after Phase 1–3
```
→ Contact DevOps team for TD-066 (ADO approval gate between stages)
```

---

## Exit Criteria (DoD — Definition of Done)

**TD-065 DONE** when:
- [ ] `azure-pipelines.yml` Build_And_Test stage includes `pytest --cov-fail-under=80`
- [ ] Local validation: `pytest tests/ --cov=src/notebooks --cov-fail-under=80` exits 0
- [ ] CI run: Push branch → verify Build_And_Test succeeds with coverage report
- [ ] Coverage report shows ≥80% for `src/notebooks/`
- [ ] Documentation: CONTRIBUTING.md updated with coverage waiver process
- [ ] Commit: `ci(pipeline): add pytest coverage gate to Build_And_Test stage`

**TD-066 PARKED** when:
- [ ] Issue created in ADO backlog (DevOps team ownership)
- [ ] Gate requirements documented: "Require approval before Dev→UAT promotion"
- [ ] Note in TECH_DEBT.md: "2026-05-11 TD-066 parked; ADO config task for DevOps team"

---

## Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `azure-pipelines.yml` write access | ✅ Yes | Branch: vnext |
| `pytest --cov` plugins | ✅ Yes | Already in `requirements-ci.txt` (pytest-cov) |
| ADO portal access | ⚠️ Optional | Only for TD-066 (parked) |

---

## Notes

- **TD-065 is quick**: One YAML addition + documentation. Can be merged immediately after Phase 1 quick wins.
- **TD-066 requires DevOps**: ADO approval gates are configured in portal, not code. Suggest creating ADO work item + assigning to DevOps team.
- **Coverage baseline**: Current tests show ≥80% coverage already; this gate just enforces it going forward.
- **No breaking changes**: Existing code already passes coverage threshold; gate won't block current PRs.

## Sprint Close Log

- **Sprint close 2026-05-11**: No implementation completed in this tranche. Carryover: TD-065 (pipeline coverage gate), TD-066 (ADO approval gate, parked for DevOps admin).
