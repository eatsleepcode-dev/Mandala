---
description: Validate the Peggy OS React build (ESLint, bundle integrity, browser preview and Python plugin linting)
// turbo-all
---

# Peggy OS Build Validation Workflow

Runs a complete quality gate on the `__inbox/peggy_os_workspace` React build and its companion Python plugin.

## Prerequisites

- Node.js >= 18 and npm installed
- Python with `ruff` available (`pip install ruff`)
- Working directory: `c:\repo\data-platform`

---

## Step 1 — Navigate to the workspace

```powershell
cd c:\repo\data-platform\__inbox\peggy_os_workspace
```

## Step 2 — Build the wizard bundle

```powershell
npm run build:wizard 2>&1 | Out-File -Encoding utf8 build_result.txt
Get-Content build_result.txt | Select-String -Pattern "built in|error|failed" -CaseSensitive:$false
```

**Pass criteria:** Output includes `built in` with no `error` or `failed` lines.

## Step 3 — Assert bundle file exists and is non-trivial

```powershell
$jsPath = "dist\wizard\index.js"
if (Test-Path $jsPath) {
    $sizeKb = [math]::Round((Get-Item $jsPath).Length / 1KB, 1)
    Write-Host "✅ Bundle exists: $sizeKb KB"
    if ($sizeKb -lt 50) { Write-Error "❌ Bundle too small — possible empty build ($sizeKb KB)" }
} else {
    Write-Error "❌ dist\wizard\index.js not found"
}
```

**Pass criteria:** File exists and is > 50 KB.

## Step 4 — Run ESLint (JS/JSX static analysis)

```powershell
npx eslint src/ --ext .js,.jsx --format stylish 2>&1 | Out-File -Encoding utf8 eslint_report.txt
$errors = Select-String -Path eslint_report.txt -Pattern " error "
$warnings = Select-String -Path eslint_report.txt -Pattern " warning "
Write-Host "ESLint: $($errors.Count) error(s), $($warnings.Count) warning(s)"
if ($errors.Count -gt 0) { Get-Content eslint_report.txt; Write-Error "❌ ESLint errors found" }
else { Write-Host "✅ No ESLint errors" }
```

**Pass criteria:** 0 errors. Warnings about `React` import in React 18 projects are expected and benign — check for real issues (hooks violations, undefined vars).

**Known benign warnings:**
- `'React' is defined but never used` — React 18 JSX transform handles this at build time

## Step 5 — Lint the Python plugin (ruff)

```powershell
cd c:\repo\data-platform
ruff check Modules\Hub_Plugins\azure_deployment_react.py --output-format concise 2>&1
```

**Pass criteria:** No `error` severity findings. Warnings are acceptable.

**Note:** If `ruff` is not installed: `pip install ruff`

## Step 6 — Check Python type stubs (optional, mypy)

```powershell
mypy Modules\Hub_Plugins\azure_deployment_react.py --ignore-missing-imports --no-strict-optional 2>&1 | Select-Object -First 30
```

**Pass criteria:** No `error:` lines.

## Step 7 — Serve the browser test harness

```powershell
cd c:\repo\data-platform\__inbox\peggy_os_workspace
npx serve . --no-clipboard -l 5174
```

Then open: http://localhost:5174/test-harness.html

**Manual checks in browser:**
- [ ] Page loads without JS console errors
- [ ] VS Code-style layout renders (sidebar, editor panel, terminal panel)  
- [ ] Sidebar step list shows 5 steps with correct icons
- [ ] Terminal panel is collapsible (click chevron)
- [ ] Sidebar is collapsible (click toggle in title bar)
- [ ] "Run Pre-flight" harness button populates checklist items with animated states
- [ ] "Simulate Log" streams lines into the terminal panel
- [ ] "Simulate Infra" shows infra checklist with step-by-step progress
- [ ] Step navigation (Step 2/3/4 buttons) switches content correctly
- [ ] Fabric brand colour (`#005a50`) visible in title bar and status bar
- [ ] Panel resize handle (drag between editor and terminal) works

## Step 8 — Check bundle for known anti-patterns

```powershell
cd c:\repo\data-platform\__inbox\peggy_os_workspace
$bundle = Get-Content dist\wizard\index.js -Raw
# Should NOT contain eval() calls
if ($bundle -match "eval\(") { Write-Warning "⚠ eval() found in bundle" } else { Write-Host "✅ No eval() in bundle" }
# Should NOT reference /mnt/ or dbutils
if ($bundle -match "dbutils|/mnt/|mssparkutils\.notebook") { Write-Warning "⚠ Forbidden Fabric API found in bundle" } else { Write-Host "✅ No forbidden APIs in bundle" }
# React should be bundled (not external)
if ($bundle -match "createElement") { Write-Host "✅ React bundled (createElement found)" } else { Write-Warning "⚠ React may not be bundled" }
```

**Pass criteria:** No `eval()`, no forbidden APIs, React bundled.

## Step 9 — Summary report

```powershell
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Peggy OS Build Validation Summary"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Step 2 — Bundle build:      check build_result.txt"
Write-Host "  Step 3 — Bundle size:       check output above"
Write-Host "  Step 4 — ESLint (JS/JSX):   check eslint_report.txt"
Write-Host "  Step 5 — Ruff (Python):     check output above"
Write-Host "  Step 7 — Browser preview:   http://localhost:5174/test-harness.html"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

## Quick Re-run (after code changes)

```powershell
# One-liner: rebuild + lint
cd c:\repo\data-platform\__inbox\peggy_os_workspace
npm run build:wizard; npx eslint src/ --ext .js,.jsx --format stylish
```

## Artefacts produced

| File | Purpose |
|---|---|
| `dist/wizard/index.js` | Compiled React bundle (anywidget ESM target) |
| `build_result.txt` | Raw Vite build output |
| `eslint_report.txt` | ESLint findings |
| `test-harness.html` | Browser smoke test page |
