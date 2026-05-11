---
description: Test-driven development — RED-GREEN-REFACTOR for data-platform notebooks and utilities.
---

# TDD Workflow — data-platform

## The RED-GREEN-REFACTOR Cycle

### 🔴 RED: Write a Failing Test

1. Write the test **before** any implementation
2. Test one behaviour only
3. Run it and watch it fail — confirm the test is valid
4. Commit the failing test

### 🟢 GREEN: Make it Pass

1. Write **minimal** code — just enough to pass
2. No premature optimisation
3. Confirm test passes

### 🔵 REFACTOR: Clean it Up

1. Improve code without changing behaviour
2. Re-run tests to confirm nothing broke
3. Commit refactoring separately from the feature commit

---

## For Python Notebook Utilities

**Test location**: `tests/`

**Critical rule — isolation**: Never hit a real Fabric Lakehouse, real KV, or real Spark session in unit tests. Mock everything external.

### Example: Testing a new ingestion utility

```python
# tests/test_nb_conn_rest.py
import pytest
from unittest.mock import MagicMock, patch

def test_paginate_raises_on_missing_data_key_for_cursor_mode():
    """🔴 RED: DataKey must be required for CURSOR pagination"""
    from src.notebooks.nb_conn_rest import paginate

    with pytest.raises(ValueError, match="DataKey is required"):
        paginate(
            base_url="https://api.example.com",
            api_key="token",
            mode="CURSOR",
            data_key="",         # empty — should raise
            auth_mode="BEARER",
        )
```

```python
# src/notebooks/nb_conn_rest.py
def paginate(base_url, api_key, mode, data_key, auth_mode):
    """🟢 GREEN: minimal guard"""
    if not data_key and mode not in ("SINGLE", "NONE"):
        raise ValueError(f"DataKey is required for PaginationMode '{mode}'")
    ...
```

### Example: Testing SQL escape logic

```python
def test_source_name_with_single_quote_is_escaped():
    """🔴 RED: SQL injection via source_name"""
    source_name = "O'Brien's Source"
    escaped = source_name.replace(chr(39), chr(39) * 2)
    assert escaped == "O''Brien''s Source"
    # Confirm it can be safely interpolated:
    sql = f"SELECT * FROM IngestionSource WHERE SourceName = '{escaped}'"
    assert "O''Brien''s Source" in sql
    assert "O'Brien's Source" not in sql
```

---

## For Schema Changes (DDL / Column Renames)

Use a "snapshot" test pattern — lock in expected column lists:

```python
def test_ingestion_config_has_13_columns():
    """🔴 RED: Column count guard"""
    EXPECTED_COLUMNS = [
        "ConfigID", "SourceID", "ObjectName", "WatermarkColumn", "SyncType",
        "SourcePath", "SourceFileFormat", "LandingFileFormat", "RelativeUrl",
        "Method", "PaginationRules", "CustomQuery", "RequiresNotebook",
    ]
    # Parse the DDL from nb_bootstrap.py and assert column names match
    import re, pathlib
    src = pathlib.Path("src/notebooks/nb_bootstrap.py").read_text()
    ddl_block = re.search(
        r"CREATE TABLE IF NOT EXISTS control\.IngestionConfig \((.+?)\) USING DELTA",
        src, re.DOTALL
    ).group(1)
    actual_cols = [line.strip().split()[0] for line in ddl_block.strip().splitlines() if line.strip()]
    assert actual_cols == EXPECTED_COLUMNS
```

---

## Commit Convention

```
feat(nb-conn-rest): add DataKey guard for CURSOR pagination [RED]
feat(nb-conn-rest): implement DataKey guard [GREEN]
refactor(nb-conn-rest): extract pagination mode constants [REFACTOR]
```

Never combine RED + GREEN + REFACTOR in one commit.

---

## Stop-and-Think Rule

If a test fails **2 times in a row** after fixes, stop. Do not push further.
Run `/pre-mortem` and re-evaluate the approach.
