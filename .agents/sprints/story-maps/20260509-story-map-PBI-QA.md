# Story Map — PBI-QA: Agentic QA Framework for Power BI

**Date**: 2026-05-09
**ADR**: ADR-061 — Unified agentic QA framework for Power BI
**Source**: `__inbox/gemini-Fabric Notebooks and Power BI Integration.txt`
**Actors**: Data Engineer, Power BI Developer, Platform Engineer, IT Consultant

---

## Actors

**Data Engineer**: configures test infrastructure, authors the QA pipeline, and runs test executions — currently frustrated by having no automated way to verify a DAX measure's output against the Gold Lakehouse SQL before deployment.

**Power BI Developer**: authors DAX measures and report visuals, reviews agent-proposed fixes — currently frustrated by discovering broken visuals via end-user complaints, with no tooling to diagnose root cause or validate a fix without republishing the whole report.

**Platform Engineer**: governs platform cost, quality, and capacity — currently frustrated by having no visibility into QA test health over time and no cost control for LLM API usage at scale.

**IT Consultant / Reviewer**: approves DAX fix deployments and audits changes — currently frustrated by having no structured approval workflow; fixes happen ad-hoc outside any audit trail.

---

## Challenge (Toyota Kata)

Zero broken Power BI reports reach production. Every DAX measure is independently
validated against the Gold Lakehouse SQL source of truth before any report is published,
and every test failure surfaces a machine-generated fix for human review within minutes.

---

## Current Condition — PBI-QA — 2026-05-09

- Visual tests automated: **0**
- Test method: **manual QA only** — reports checked by eye before release
- DAX validation: **tautological** — sempy.evaluate_dax tests DAX against the same model
  that produced it; a broken measure passes the test
- Failure detection lag: **reported by end users** after production deployment
- MTTR for DAX bugs: **hours** — developer must locate measure, diagnose filter context,
  rewrite, republish
- PBIP adoption: **not yet configured** — no Git-integrated report definition available
- QA_Visual_Tests table: **does not exist**
- QA_Test_Executions table: **does not exist**
- Azure AI Foundry project: **provisioned** — `af-duk-dev-dataplatform` (AIServices v2, UK South), project `afp-duk-dev-dataplatform`, model `gpt-4o 2024-11-20` (GlobalStandard). SDK: `azure-ai-projects` `AIProjectClient`. Project endpoint stored in KV as `foundry-project-endpoint`.

---

## Target Condition — Sprint 1 (Walking Skeleton)

- End-to-end baseline test runs: **≥1 visual on ≥1 page** validated against Gold SQL
- Test result destination: **QA_Test_Executions Delta table** — contains timestamp,
  visual ID, expected value, actual value, status
- Variance threshold enforced: test FAILED if `|V_ui − V_sql| > 0.01`
- PBIP parser notebook: **seeds ≥1 row** into QA_Visual_Tests from a sample report
- Human can observe: **a pass/fail result for one real visual without clicking anything**
- Failures visible in stdout: **readable without querying a database table**
- Fix loop testable: **retest_measure() callable in a notebook cell before TMSL built**
- Run summary logged: **pass/fail count in stdout visible in ADO pipeline log**

---

## Story Map

### Backbone

| A1 | A2 | A3 | A4 | A5 | A6 | A7 |
|---|---|---|---|---|---|---|
| Configure Infrastructure | Discover Report Structure | Generate Test Plan | Execute Visual Tests | Review Failures | Deploy Fixes | Monitor QA Health |

---

### A1: Configure Infrastructure

*As a data engineer, I set up the platform pieces that everything else depends on.*

**T1.1 — Provision QA Delta tables**

> US-001 🦴 As a **data engineer**, I want to create the `QA_Visual_Tests` and
> `QA_Test_Executions` Delta tables in the control Lakehouse so that the test execution
> loop has a persistent, queryable configuration and audit store.
>
> Acceptance criteria:
> - [ ] `QA_Visual_Tests` table exists with columns: Test_ID, Page_Name, Visual_ID,
>       Test_Type, UI_Filter_JSON, Underlying_SQL_Query
> - [ ] `QA_Test_Executions` table exists with columns: Timestamp, Page, Visual_ID,
>       Test_Type, Expected_Value, Actual_Value, Status, Variance
> - [ ] Both tables are Delta format in `lh_control`
>
> Toyota Kata hypothesis: once these tables exist, the test loop can write and query
> results without blocking on schema discovery.

**T1.2 — Configure PBIP Git integration**

> US-002: As a **data engineer**, I want the Power BI report saved in PBIP format
> and synced to the Fabric Git repository so that visual.json and page.json files
> are available for programmatic parsing.
>
> Acceptance criteria:
> - [ ] Report opens in Power BI Desktop with PBIP preview feature enabled
> - [ ] `{Report}.Report/pages/{page}/visuals/{id}/visual.json` exists in the repo
> - [ ] `{Report}.Report/pages/{page}/page.json` exists in the repo
>
> Toyota Kata hypothesis: PBIP files in Git enable the parser notebook to discover
> visual IDs without any manual mapping step.

**T1.3 — Provision Azure AI Foundry project**

> US-003: As a **platform engineer**, I want an Azure AI Foundry project with a
> deployed GPT-4o endpoint so that the agentic fixer has managed compute with
> OpenTelemetry tracing and durable orchestration support.
>
> **Status: ✅ PROVISIONED — 2026-05-09**
>
> Foundry v2 (AIServices kind — new SDK: `azure-ai-projects`):
> - Account: `af-duk-dev-dataplatform` (UK South, S0, GlobalStandard)
> - Project: `afp-duk-dev-dataplatform`
> - Model: `gpt-4o 2024-11-20` — GlobalStandard, 10 TPM units, `agentsV2: true`
> - Project endpoint (KV: `foundry-project-endpoint`):
>   `https://af-duk-dev-dataplatform.services.ai.azure.com/api/projects/afp-duk-dev-dataplatform`
> - Model deployment name (KV: `foundry-model-deployment`): `gpt-4o`
> - Auth: `DefaultAzureCredential` (Workspace Identity in Fabric, `az login` locally)
> - SDK usage:
>   ```python
>   from azure.ai.projects import AIProjectClient
>   from azure.identity import DefaultAzureCredential
>   client = AIProjectClient(
>       endpoint=get_secret(spark, kv_url, "foundry-project-endpoint"),
>       credential=DefaultAzureCredential(),
>   )
>   ```
>
> Acceptance criteria:
> - [x] Foundry project exists in `rg-duk-dev-dataplatform` (UK South)
> - [x] `gpt-4o 2024-11-20` deployment active and callable (`agentsV2: true`)
> - [x] Project endpoint stored in `kv-duk-dev-dataplatform` as `foundry-project-endpoint`
> - [x] Model deployment name stored as `foundry-model-deployment`
> - [x] Auth via `DefaultAzureCredential` — no hardcoded keys
>
> Toyota Kata hypothesis: once the endpoint is live, the RCA function can be called
> from any notebook without hardcoded credentials.

---

### A2: Discover Report Structure

*As a data engineer, I parse the report's own blueprints so I never have to map visual IDs by hand.*

**T2.1 — Parse visual.json for visual IDs and field mappings**

> US-004 🦴 As a **data engineer**, I want a notebook to traverse the PBIP directory
> and extract every visual ID, visual type, and the measures/columns it consumes so that
> QA_Visual_Tests is seeded without manual data entry.
>
> Acceptance criteria:
> - [ ] Notebook uses `os.walk` over the PBIP `pages/` directory
> - [ ] Each data-bound visual produces one row in a seed DataFrame
>       with columns: Page_Name, Visual_ID, Visual_Type, Fields_Used
> - [ ] Text boxes and shapes (no `query` node) are excluded
> - [ ] DataFrame is written to `QA_Visual_Tests` in append mode
>
> Toyota Kata hypothesis: seeding from PBIP means adding a new visual to the report
> automatically adds it to the test plan on the next parser run.

**T2.2 — Extract measure expressions from the semantic model**

> US-005: As a **data engineer**, I want to call `sempy-labs fabric.list_measures()`
> to build a measure dictionary so that when the agent generates a SQL baseline,
> it receives the actual DAX formula — not just the measure name.
>
> Acceptance criteria:
> - [ ] Measure dictionary is a Python dict: `{measure_name: dax_expression}`
> - [ ] Dictionary is built before the LLM prompt is constructed
> - [ ] If a measure is not found, the row is flagged `NEEDS_REVIEW` not silently skipped
>
> Toyota Kata hypothesis: injecting the DAX formula into the LLM prompt eliminates
> the hallucination risk where the agent guesses an incorrect SQL aggregation.

**T2.3 — Parse page.json interaction overrides**

> US-006: As a **data engineer**, I want to parse `page.json` interaction nodes so
> that cross-filter test cases are only generated for visual pairs where cross-filtering
> is active (not disabled by the developer).
>
> Acceptance criteria:
> - [ ] `does_visual_crossfilter(source_id, target_id)` returns False when
>       `interaction.type == 2` (disabled) in `page.json`
> - [ ] Returns True (default) when no explicit interaction rule exists
> - [ ] Test case rows are not written to `QA_Visual_Tests` for disabled pairs
>
> Toyota Kata hypothesis: reading the interaction map eliminates false failures caused
> by testing a cross-filter path the developer has intentionally suppressed.

---

### A3: Generate Test Plan

*As a data engineer, I generate SQL baselines and filter permutations automatically so the test plan stays current without human maintenance.*

**T3.1 — Agent generates SQL baselines from PBIP + DAX metadata**

> US-007 🦴 As a **data engineer**, I want the Foundry agent to translate each
> visual's field list + DAX formula into a Gold Lakehouse SQL query so that
> `QA_Visual_Tests.Underlying_SQL_Query` is populated without manual authoring.
>
> **Foundry dependency: ✅ UNBLOCKED** — `af-duk-dev-dataplatform` / `gpt-4o` provisioned 2026-05-09.
> Uses `AIProjectClient` (azure-ai-projects v2 SDK). Agent invoked via
> `client.agents.create_agent()` with `model="gpt-4o"`.
>
> Acceptance criteria:
> - [ ] Agent system prompt includes the database schema
>       (`SELECT table_name, column_name FROM information_schema.columns`)
> - [ ] Agent system prompt includes the actual DAX formula for each measure
> - [ ] Complex queries (time intelligence, REMOVEFILTERS) are flagged `NEEDS_REVIEW`
> - [ ] Generated SQL is stored in `QA_Visual_Tests.Underlying_SQL_Query`
>
> Toyota Kata hypothesis: schema-grounded SQL generation reduces hallucinated
> table/column names to near-zero for simple aggregation measures.

**T3.2 — Dynamically sample filter values from Gold layer**

> US-008: As a **data engineer**, I want the test plan generator to query
> `SELECT DISTINCT {column} FROM {gold_table} LIMIT 3` for each slicer field so
> that cross-filter test cases use live data values, not hardcoded strings.
>
> Acceptance criteria:
> - [ ] Filter values are fetched via Spark SQL at plan-generation time
> - [ ] Null values are excluded from the sampled list
> - [ ] Each live value generates one `Cross_Filter` row in `QA_Visual_Tests`
> - [ ] If the column is not found in Gold, the row is flagged `NEEDS_REVIEW`
>
> Toyota Kata hypothesis: sampling live values means tests never fail because a
> dimension member was retired from the data.

**T3.3 — BPA scan gates the pipeline before UI tests run**

> US-009: As a **Power BI developer**, I want `sempy-labs run_bpa()` to execute
> as the first gate in the CI pipeline so that structural model errors (high-severity
> BPA violations) block the test execution loop before it wastes capacity on a
> fundamentally broken model.
>
> Acceptance criteria:
> - [ ] `run_bpa(dataset=...)` is called before `export_visual_data`
> - [ ] If any High-severity BPA rule fires, the pipeline fails with the violation list
> - [ ] Medium/Low violations are logged to `QA_Test_Executions` as warnings, not failures
>
> Toyota Kata hypothesis: a BPA gate reduces wasted test runs against models with
> known structural errors.

---

### A4: Execute Visual Tests

*As a data engineer, I run the tests — baseline, cross-filter, and drill-through — without clicking anything.*

**T4.1 — Extract baseline visual data and compare to SQL**

> US-010 🦴 As a **data engineer**, I want to call `report.export_visual_data(page, visual_id)`
> and compare the summed metric to the Gold SQL result so that the baseline test asserts
> the rendered UI matches the independent source of truth.
>
> Acceptance criteria:
> - [ ] `export_visual_data` result is parsed into a Pandas DataFrame
> - [ ] The metric column is summed and compared to the SQL query result
> - [ ] Test PASSES if `|V_ui − V_sql| ≤ 0.01`; FAILS otherwise
> - [ ] Result row is appended to `QA_Test_Executions` with timestamp and both values
>
> Toyota Kata hypothesis: once this cycle is green, one end-to-end test exists that
> proves the rendering pipeline is connected to the SQL truth — the core invariant
> of ADR-061.

**T4.2 — Simulate cross-filter interactions and verify target visuals**

> US-011: As a **data engineer**, I want to apply `BasicFilter` objects to the
> report iframe and verify that target visuals update their exported data accordingly
> so that filter propagation paths are tested without human mouse clicks.
>
> Acceptance criteria:
> - [ ] `report.update_filters([BasicFilter(...)])` is called per test row
> - [ ] `time.sleep(3)` pause is applied after filter injection before data extraction
> - [ ] Target visual data is re-fetched and compared to the filtered SQL baseline
> - [ ] `report.remove_filters()` is called after each test to reset state
>
> Toyota Kata hypothesis: programmatic filter injection exercises the same DAX
> filter context as a user clicking a slicer, without requiring browser interaction.

**T4.3 — Simulate drill-through navigation and verify destination visuals**

> US-012: As a **data engineer**, I want to use `report.set_page(target_page)` and
> apply the drill-through filter context so that cross-page data relationships are
> validated end-to-end.
>
> Acceptance criteria:
> - [ ] `report.set_page(target_page)` navigates to the drill destination
> - [ ] Drill-through filter is applied via `report.update_filters()`
> - [ ] Each target visual (X, Y, Z) is extracted and compared to its own DAX query
> - [ ] Separate `QA_Test_Executions` rows written for each target visual
>
> Toyota Kata hypothesis: a drill-through test catches cases where the filter context
> passed from Page A to Page B is incorrectly scoped in the report definition.

**T4.4 — Loop through all QA_Visual_Tests rows in a single execution run**

> US-013: As a **data engineer**, I want the test executor to iterate through all rows
> in `QA_Visual_Tests` and log each result to `QA_Test_Executions` so that the entire
> test plan runs unattended.
>
> Acceptance criteria:
> - [ ] Executor reads `QA_Visual_Tests` into a DataFrame at runtime
> - [ ] Each row triggers the appropriate test method (Baseline / Cross_Filter / Drill_Through)
> - [ ] Errors in one row do not abort the loop — exception is caught and logged as FAIL
> - [ ] Execution summary printed: N passed, M failed, K errored
>
> Toyota Kata hypothesis: a loop executor with per-row error isolation means one
> flaky visual doesn't hide failures in other visuals.

---

### A5: Review Failures

*As a Power BI developer, I review agent-proposed fixes and decide what to deploy.*

**T5.0 — Print failure summary to stdout (skeleton)**

> US-021 🦴 As a **data engineer**, I want failed test rows printed to stdout at the
> end of a test run so that I can see what failed without querying a database table.
>
> Acceptance criteria:
> - [ ] After the test loop, FAILED rows from `QA_Test_Executions` for this run are retrieved
> - [ ] Each failure prints one line: `FAIL | {visual_id} | expected={expected} | actual={actual} | variance={variance}`
> - [ ] If zero failures, prints `All {N} tests PASSED`
> - [ ] No AI, no widget, no Teams notification — stdout only
>
> Toyota Kata hypothesis: a developer can confirm the test loop produces meaningful
> output before committing to the RCA and HITL infrastructure.

**T5.1 — Agent performs Root Cause Analysis on DAX failures**

> US-014: As a **Power BI developer**, I want the Foundry agent to receive the
> broken DAX, the SQL baseline, and the variance and return a diagnosis +
> corrected DAX formula so that I understand why the test failed before deciding
> whether to deploy a fix.
>
> **Foundry dependency: ✅ UNBLOCKED** — `af-duk-dev-dataplatform` / `gpt-4o` provisioned 2026-05-09.
>
> Acceptance criteria:
> - [ ] Agent prompt includes: measure name, current DAX, SQL baseline, expected value, actual value
> - [ ] Agent response is parsed for `EXPLANATION:` and `DAX:` sections
> - [ ] If parsing fails, the raw response is surfaced to the human — not silently discarded
> - [ ] Agent response is stored against the `QA_Test_Executions` row
>
> Toyota Kata hypothesis: structured prompt output (EXPLANATION + DAX sections)
> enables reliable parsing so the HITL UI can display the diagnosis without asking
> the user to read raw LLM output.

**T5.2 — HITL widget in notebook for ad-hoc approval**

> US-015: As a **Power BI developer**, I want an ipywidgets UI surfacing the
> agent's diagnosis, the current DAX, and the proposed fix so that I can approve
> or reject without leaving the notebook.
>
> Acceptance criteria:
> - [ ] Widget displays: expected vs actual values, EXPLANATION, current DAX, proposed DAX (editable)
> - [ ] Approve button calls `deploy_dax_fix()` with the (possibly edited) proposed DAX
> - [ ] Reject button logs the rejection and moves to the next failure
> - [ ] Widget only appears in `run_mode == "Ad-hoc"`; CI mode raises `sys.exit(1)` instead
>
> Toyota Kata hypothesis: an editable proposed-DAX field means the developer can
> accept the agent's diagnosis but still refine the fix — keeping humans in control
> of the final expression.

**T5.3 — CI pipeline posts RCA to ADO on failure**

> US-016: As an **IT consultant**, I want the CI pipeline notebook to raise
> `sys.exit(1)` with the agent's RCA summary when any test fails so that the
> Azure DevOps pipeline shows a meaningful failure reason, not just "notebook errored".
>
> Acceptance criteria:
> - [ ] `run_mode` parameter cell defaults to `"Ad-hoc"`; ADO pipeline overrides to `"CI"`
> - [ ] In CI mode, `sys.exit(1)` is called after writing failure details to stdout
> - [ ] stdout output includes: visual ID, expected, actual, variance, agent explanation
> - [ ] ADO pipeline marks the stage FAILED and surfaces the notebook output as the error log
>
> Toyota Kata hypothesis: structured stdout + `sys.exit(1)` integration means
> broken PBI builds are blocked at the gate with actionable context, not just a
> generic pipeline failure.

---

### A6: Deploy Fixes

*As a Power BI developer, I deploy approved DAX fixes without republishing the entire .pbix.*

**T6.0 — Manual retest with corrected DAX (skeleton)**

> US-022 🦴 As a **Power BI developer**, I want to call `retest_measure(visual_id, new_dax)`
> in a notebook cell with corrected DAX so that I can verify the fix closes the variance
> gap before building the TMSL automation.
>
> Acceptance criteria:
> - [ ] `retest_measure(visual_id, new_dax)` function exists in the QA notebook
> - [ ] Function re-runs the baseline comparison using the provided DAX expression
>       as a temporary SQL-equivalent override (not pushed to the semantic model)
> - [ ] Function prints PASS/FAIL with variance to stdout
> - [ ] No TMSL, no semantic model push — developer manually republishes after confirming
>
> Toyota Kata hypothesis: the fix validation loop is testable before TMSL infrastructure
> is built; the developer confirms the correct SQL equivalent before touching the model.

**T6.1 — Deploy corrected DAX via TMSL to XMLA endpoint**

> US-017: As a **Power BI developer**, I want `fabric.execute_tmsl()` to push
> a `createOrReplace` measure payload to the semantic model so that fixes are
> live in seconds, without a full report republish cycle.
>
> Acceptance criteria:
> - [ ] TMSL payload is constructed from: dataset name, table name, measure name, new DAX
> - [ ] `fabric.execute_tmsl(dataset=..., tmsl_string=...)` executes without error
> - [ ] After deployment, the test for the fixed measure is re-run automatically
> - [ ] Re-run result is written to `QA_Test_Executions` as a new row
>
> Toyota Kata hypothesis: TMSL deployment + automatic re-test closes the loop —
> the developer sees PASS/FAIL for their fix within the same notebook session.

**T6.2 — Durable HITL for enterprise approval flows**

> US-018: As an **IT consultant**, I want the Foundry agent to pause execution
> (wait_for_external_event) after proposing a fix so that approval can happen
> asynchronously — a reviewer with a 2-day turnaround doesn't block the agent's state.
>
> **Foundry dependency: ✅ UNBLOCKED** — `af-duk-dev-dataplatform` / `afp-duk-dev-dataplatform` provisioned 2026-05-09.
> Durable orchestration uses Foundry Agent Service (`agentsV2: true` confirmed on deployment).
>
> Acceptance criteria:
> - [ ] Agent enters a durable wait state after posting the HITL approval request
> - [ ] Approval notification is routed to Teams channel or Phoric UI
> - [ ] On approval, agent wakes, deploys TMSL, re-runs test, and closes the loop
> - [ ] On rejection, agent logs the decision and proceeds to the next failure
>
> Toyota Kata hypothesis: durable orchestration eliminates the timeout problem of
> ipywidgets sessions — approval can happen days later without restarting the agent.

---

### A7: Monitor QA Health

*As a platform engineer, I observe test health over time and control costs.*

**T7.0 — Pass/fail count summary to stdout (skeleton)**

> US-023 🦴 As a **platform engineer**, I want a pass/fail count summary printed to
> stdout at the end of every test run so that I can verify the framework is tracking
> results over time without building the Power BI dashboard.
>
> Acceptance criteria:
> - [ ] Stdout shows: `Run complete: {N_pass} passed, {M_fail} failed, {K_error} errored at {timestamp}`
> - [ ] Summary includes total visual count tested and run timestamp
> - [ ] Output is produced by the existing execution loop (extends US-013) — no new query required
> - [ ] Viewable in ADO pipeline log without parsing
>
> Toyota Kata hypothesis: a persistent count in the pipeline log proves the monitoring
> capability exists before investing in a Power BI dashboard over `QA_Test_Executions`.

**T7.1 — QA health visible in Power BI**

> US-019: As a **platform engineer**, I want `QA_Test_Executions` exposed as a
> Gold Delta table so that a Power BI report can show test pass rates, variance
> trends, and MTTR over time.
>
> Acceptance criteria:
> - [ ] `QA_Test_Executions` is registered in `lh_control` Gold schema
> - [ ] A sample Power BI report or DirectLake semantic model connects to the table
> - [ ] Key metrics visible: pass rate by visual, average variance, failures by page
>
> Toyota Kata hypothesis: making QA data queryable in the same tool used to view
> reports creates a self-referential validation loop — the QA dashboard is itself
> tested by the QA framework.

**T7.2 — Incremental testing (PR-scoped)**

> US-020: As a **platform engineer**, I want the CI pipeline to scope the test
> plan to only the visuals whose PBIP files changed in the PR diff so that test
> compute scales with change size, not report size.
>
> Acceptance criteria:
> - [ ] Pipeline reads `git diff --name-only origin/main` to list changed PBIR files
> - [ ] Only visual IDs from changed `visual.json` files are included in the test run
> - [ ] Full test run is available as a separate pipeline stage (manual trigger)
> - [ ] Incremental test run cost is logged: N visuals tested, M skipped
>
> Toyota Kata hypothesis: incremental scoping reduces per-PR LLM API cost by
> approximately `(N_changed / N_total) * 100%` — measurable after first 5 PRs.

---

## Walking Skeleton

The minimum end-to-end slice that proves the architecture works:

| Story | Activity | Actor | Experiment hypothesis |
|---|---|---|---|
| US-001 🦴 | A1 Configure | Data Engineer | Once tables exist, the loop can write and query without schema discovery |
| US-004 🦴 | A2 Discover | Data Engineer | PBIP parser seeds ≥1 visual row without manual mapping |
| US-007 🦴 | A3 Generate | Data Engineer | Foundry agent generates valid SQL for ≥1 measure |
| US-010 🦴 | A4 Execute | Data Engineer | One visual's rendered value matches Gold SQL — end-to-end |
| US-021 🦴 | A5 Review | Data Engineer | Failed tests are visible in stdout — no AI required to see what broke |
| US-022 🦴 | A6 Deploy | Power BI Developer | Fix can be validated in a notebook cell before any model push |
| US-023 🦴 | A7 Monitor | Platform Engineer | Pass/fail count in pipeline log proves tracking exists before dashboard build |

A developer can observe end-to-end value after US-010 GREEN: one real visual passes a test
that was impossible to run this morning. US-021 confirms failures surface to the developer.
US-022 proves the fix loop closes without TMSL. US-023 proves monitoring exists.

---

## Backlog (below the skeleton — prioritised)

| Priority | Story | Rationale |
|---|---|---|
| 1 | US-005 — Measure dictionary | Eliminates LLM hallucination risk; blocks US-007 quality |
| 2 | US-006 — Interaction overrides | Prevents false failures from disabled cross-filters |
| 3 | US-008 — Live filter values | Stops test rot from hardcoded dimension members |
| 4 | US-009 — BPA gate | Catches structural model errors before wasting test capacity |
| 5 | US-011 — Cross-filter simulation | Extends coverage beyond baseline tests |
| 6 | US-013 — Full execution loop | Runs all test rows unattended |
| 7 | US-014 — RCA agent | Reduces MTTR; enables HITL fix workflow |
| 8 | US-015 — HITL widget | Developer-facing fix approval interface |
| 9 | US-016 — CI hard-fail | ADO pipeline integration; gates broken builds |
| 10 | US-017 — TMSL deployment | Closes the fix loop; re-tests after deployment |
| 11 | US-012 — Drill-through tests | Extended coverage for cross-page flows |
| 12 | US-019 — QA health dashboard | Platform observability |
| 13 | US-020 — Incremental testing | Cost control at scale |
| 14 | US-002 — PBIP Git integration | Prerequisite for full parser adoption |
| 15 | US-003 — Foundry provisioning | Prerequisite for production agent hosting |
| 16 | US-018 — Durable HITL | Enterprise-grade approval flow |
| 17 | US-024 — PBIR config assertions | Tests visual sort + filter config; no iframe needed |
| 18 | US-025 — pbi_fixer batch fix | Lighter alternative to TMSL for bulk structural fixes |

---

## Revision 1 — 2026-05-09

**Source**: second pass of `__inbox/gemini-Fabric Notebooks and Power BI Integration.txt`
**Change type**: Append — three new insights not captured in initial story map.

### New story: US-024 — PBIR structural configuration tests

**Activity:** A2 Discover (extends T2.1 parser to configuration assertion)

> US-024: As a **Power BI developer**, I want a notebook to parse `visual.json`
> from the PBIP/PBIR directory and assert sort orders and visual-level filters match
> the intended report specification so that structural regressions are caught in CI
> without loading the report in a browser.
>
> Acceptance criteria:
> - [ ] `assert_visual_sort(visual_json_path, column, direction)` reads `visual.orderBy`
>       and raises `AssertionError` if direction does not match
> - [ ] `assert_visual_filter(visual_json_path, column, value)` reads `visual.filters`
>       and raises `AssertionError` if the expected filter is absent
> - [ ] Tests run offline (no iframe, no `powerbiclient` required)
> - [ ] Each assertion produces one row in `QA_Test_Executions` with type `Config_Assert`
>
> Toyota Kata hypothesis: offline JSON parsing eliminates `time.sleep()` flakiness
> entirely for structural checks — these tests are deterministic and run in <1 s per visual.
>
> **Rationale for new story (not already in US-004):** US-004 seeds `QA_Visual_Tests` rows
> from PBIR (discovery). US-024 *asserts* that the configuration encoded in PBIR matches
> the intended spec (testing). The distinction: discovery reads structure once; assertion
> runs every CI cycle and can fail.

---

### New story: US-025 — pbi_fixer batch fix UI as an alternative to TMSL

**Activity:** A6 Deploy (lightweight alternative to US-017 TMSL deployment)

> US-025: As a **Power BI developer**, I want to launch `pbi_fixer()` inside a Fabric
> Notebook to apply bulk formatting, structural, and best-practice fixes across report
> visuals so that common fixable violations are resolved interactively without authoring
> TMSL payloads.
>
> Acceptance criteria:
> - [ ] `%pip install git+https://github.com/KornAlexander/semantic-link-labs.git@feature/pbi-fixer-ui`
>       installs without error in the Fabric Notebook environment
> - [ ] `from sempy_labs import pbi_fixer; pbi_fixer()` launches the interactive widget
> - [ ] At least one BPA violation fixed via `pbi_fixer()` re-runs clean through `run_bpa()`
> - [ ] Used for BPA-category violations; US-017 TMSL remains the path for agent-generated
>       DAX measure replacements
>
> Toyota Kata hypothesis: `pbi_fixer()` reduces the TMSL authoring burden for structural
> violations to zero — the developer confirms fixes in the widget; the agent focuses on
> DAX logic, not formatting.
>
> **Note:** This is a third-party fork awaiting merge into the official `semantic-link-labs`
> package. Pin the install URL and review on each sprint if the PR has been merged.

---

### Enhancement note: `get_filters()` guard for US-011

The Gemini source documents `report.get_filters(page_name)` as a mechanism to read
existing page-level filters before injecting test-specific filters. Add to US-011 implementation:

```python
# Before applying test filter, clear any pre-existing page filters
existing_filters = report.get_filters(active_page)
if existing_filters:
    report.remove_filters()  # reset to clean state
report.update_filters([interaction_filter])
```

This prevents false failures caused by pre-existing page-level filter state from a previous
test iteration (especially relevant when the test harness is run interactively rather than
in a fresh CI notebook kernel).

**Implementation location:** `T4.2 — Simulate cross-filter interactions` (US-011). No new
story required — this is an acceptance-criteria-level detail within the existing story.
