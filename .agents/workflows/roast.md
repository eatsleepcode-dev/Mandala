---
description: "Roast" session — ruthless audit of AI-generated or LLM-assisted code before marking complete.
---

# Roast Session (Vibe Code Hardening)

**When to use**: Before marking any notebook function or feature "done". Run in a **fresh chat window** — fresh context prevents the AI from defending its own code.

---

## The Roast Prompt

Copy the function(s) you want audited and paste with this prompt:

```
Here is the code for [FEATURE NAME — e.g. "_ingest_landing_to_bronze in nb_landing_to_bronze.py"].

I want you to act as a ruthless Security and QA Auditor for a Microsoft Fabric data platform.

Roast this code: Find every potential bug, security vulnerability, and logic error.

Edge Cases: List 5 distinct scenarios where this code would break, e.g.:
- ObjectName contains a single quote
- LandingFileFormat is NULL or empty string
- Watermark folder timestamp has unexpected format
- Spark session unavailable / Delta table missing
- Source has 0 rows but watermark must still advance

SQL Injection Check: Identify every location where a Python variable is interpolated into a Spark SQL string. Is each one escaped or cast correctly?

LLM Coding Issues: Flag any "LLM elephant" patterns:
- Boolean blindness (truthy check that also passes on unexpected types)
- Silent swallowing of exceptions (bare `except: pass`)
- Off-by-one in watermark comparisons
- Column name drift (e.g. CreatedAt vs CreatedDate)
- Wrong default (e.g. hardcoded format string that used to be a constant)
- Ordering bug (variable computed before the value it depends on is read)

Fix it: Rewrite the problematic sections to be bulletproof.
```

---

## Platform-Specific Elephants to Always Check

| Pattern | What breaks |
|---|---|
| `obj.get("LandingFileFormat") or "parquet"` | Passes `0`, `False` through — OK for strings, but check type |
| `f"WHERE SourceID = {source_id}"` | Should be `int(source_id)` — never raw string |
| `f"WHERE ObjectName = '{object_name}'"` | Must be `object_name.replace(chr(39), chr(39)*2)` |
| `conn.get("AuthMode", "BEARER")` | Correct default — verify it's not `None` |
| `data_key = ""` | Correct default — verify CURSOR/OFFSET/LINK_HEADER guard present |
| `CreatedDate` vs `CreatedAt` | DDL uses `CreatedDate` — any UPDATE must not reference `CreatedAt` |
| `%run` magic lines | Will cause `ast.parse()` to fail — strip before parsing |
| `PYDANTIC_AVAILABLE` flag | Fallback path must mirror Pydantic validation — check both paths |

---

## After the Roast

1. Apply all critical fixes
2. Re-run the AST check:
   ```powershell
   & "C:\Users\scottm\.local\bin\python3.12.exe" -c "import ast, re; src=open(r'src\notebooks\[file].py').read(); ast.parse(re.sub(r'^%.*$','',src,flags=re.MULTILINE)); print('OK')"
   ```
3. Document in the task card iteration log: "Roast complete — [N] issues found and fixed"
4. Run Gate 1 security scan

---

## Quality Gates Checklist (post-roast)

- [ ] Roast session completed in fresh context
- [ ] All critical findings fixed
- [ ] No hardcoded secrets (`git grep -i "api_key\|password\|secret\|token"`)
- [ ] Error handling on all external calls (KV, Spark SQL, REST API)
- [ ] Input validation using Pydantic or `_validate_with_fallback`
- [ ] Regression check: existing tests still pass
