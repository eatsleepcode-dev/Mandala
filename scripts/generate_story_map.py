#!/usr/bin/env python3
"""
Generate Peggy V-next Jeff Patton User Story Map.
Run from repo root:  python scripts/generate_story_map.py
Output: docs/images/story-map-vnext.png  (and .svg)

Layout (top → bottom):
  Title / subtitle
  Persona row
  Activity backbone  (6 columns)
  Spine tasks        (key tasks per activity — the "walking skeleton")
  ── RELEASE 0: DONE (Sprints 1–6) ──────────────────────────────
  Story cards
  ── RELEASE 1: V-next Sprints 7–8  (GAP-07/08/09) ──────────────
  Story cards
  ── RELEASE 2: V-next Sprints 9–10 (GAP-10/11) ─────────────────
  Story cards
  ── RELEASE 3: Backlog  (GAP-12–25) ────────────────────────────
  Story cards
  Legend
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# ── Palette ──────────────────────────────────────────────────────────────────
PAGE_BG    = '#FAFAFA'
HEADER_COL = '#1A237E'

# Activity column accent colours
ACT_EC = ['#1B5E20', '#0D47A1', '#4A148C', '#BF360C', '#006064', '#37474F']
ACT_FC = ['#C8E6C9', '#BBDEFB', '#E1BEE7', '#FFCCBC', '#B2EBF2', '#CFD8DC']

# Release band colours  (border, light bg, divider bar)
REL = {
    'done':    ('#2E7D32', '#F1F8E9', '#A5D6A7'),
    's7s8':    ('#E64A19', '#FBE9E7', '#FFAB91'),
    's9s10':   ('#00695C', '#E0F7FA', '#80CBC4'),
    'backlog': ('#1565C0', '#E8EAF6', '#9FA8DA'),
}

# Story card colours by release
STORY_EC = {
    'done':    '#388E3C',
    's7s8':    '#E64A19',
    's9s10':   '#00695C',
    'backlog': '#303F9F',
    'empty':   '#CFD8DC',
}
STORY_FC = {
    'done':    '#F9FBE7',
    's7s8':    '#FFF8F6',
    's9s10':   '#F0FDFA',
    'backlog': '#EEF0FF',
    'empty':   '#F5F5F5',
}

PAD = 0.008
COL_GAP = 0.005
CARD_GAP = 0.003


def bbox(ax, x, y, w, h, ec, fc, lw=1.0, radius='round,pad=0.002', zorder=2):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle=radius,
        linewidth=lw, edgecolor=ec, facecolor=fc, zorder=zorder))


def text(ax, x, y, s, fs=6, color='#1A1A1A', bold=False, ha='left', va='center', z=5):
    ax.text(x, y, s, fontsize=fs, fontweight='bold' if bold else 'normal',
            color=color, ha=ha, va=va, zorder=z, clip_on=True)


def activity_card(ax, x, y, w, h, col_i, title, persona, notebooks):
    ec, fc = ACT_EC[col_i], ACT_FC[col_i]
    bbox(ax, x, y, w, h, ec, ec, lw=0, zorder=2)                         # solid header
    bbox(ax, x, y, w * 0.055, h, ec, ec, lw=0, zorder=3)                 # strip (redundant but consistent)
    text(ax, x + w / 2, y + h * 0.70, title, fs=7.2, bold=True,
         color='white', ha='center', z=4)
    text(ax, x + w / 2, y + h * 0.44, persona, fs=5.5,
         color='white', ha='center', z=4)
    text(ax, x + w / 2, y + h * 0.20, notebooks, fs=4.6,
         color='#E8F5E9', ha='center', z=4)


def spine_card(ax, x, y, w, h, col_i, lines):
    ec, fc = ACT_EC[col_i], ACT_FC[col_i]
    bbox(ax, x, y, w, h, ec, fc, lw=1.2, zorder=2)
    bbox(ax, x, y, w * 0.040, h, ec, ec, lw=0, zorder=3)
    n = len(lines)
    for i, line in enumerate(lines):
        ly = y + h * (0.85 - i * (0.75 / max(n - 1, 1)))
        text(ax, x + w * 0.07, ly, line,
             fs=max(4.2, min(5.8, h * 72 * 0.22 / n)),
             color='#1A1A1A', ha='left', va='center', z=4)


def story_card(ax, x, y, w, h, release, title, sub=''):
    if not title:
        return
    ec = STORY_EC[release]
    fc = STORY_FC[release]
    bbox(ax, x, y, w, h, ec, fc, lw=0.9, zorder=3)
    bbox(ax, x, y, w * 0.045, h, ec, ec, lw=0, zorder=4)
    tx = x + w * 0.08
    fs_t = max(4.0, min(5.8, h * 72 * 0.30))
    text(ax, tx, y + h * 0.63, title, fs=fs_t, bold=True,
         color='#1A1A1A', ha='left', z=5)
    if sub:
        text(ax, tx, y + h * 0.24, sub, fs=max(3.5, fs_t - 1.2),
             color='#555555', ha='left', z=5)


def release_divider(ax, y, h, release, label):
    ec, _, bar_c = REL[release]
    bbox(ax, PAD, y, 1 - 2 * PAD, h, ec, bar_c, lw=0, radius='round,pad=0.001', zorder=6)
    text(ax, 0.5, y + h / 2, label, fs=7, bold=True,
         color='white', ha='center', va='center', z=7)


def draw_columns(ax, col_xs, col_w, y_top, band_h, stories_by_col, release):
    """Draw story cards for one release band across all columns."""
    n_cols = len(col_xs)
    for ci in range(n_cols):
        stories = stories_by_col[ci] if ci < len(stories_by_col) else []
        n = len(stories)
        if n == 0:
            continue
        card_h = (band_h - (n - 1) * CARD_GAP) / n
        for si, (title, sub) in enumerate(stories):
            cy = y_top - (si + 1) * card_h - si * CARD_GAP
            story_card(ax, col_xs[ci], cy, col_w, card_h, release, title, sub)


# ══════════════════════════════════════════════════════════════════════════════
# CONTENT DEFINITIONS
# ══════════════════════════════════════════════════════════════════════════════

ACTIVITIES = [
    # (title, persona, key_notebooks_line)
    ('Connect & Ingest',          'Data Engineer',           'nb_conn_jdbc/rest/file/mirror/dataverse'),
    ('Process & Enrich',          'Data Engineer',           'nb_landing_to_bronze  nb_bronze_to_silver'),
    ('Quality & Governance',      'Data Steward',            'nb_apply_masking  nb_bronze_profiling'),
    ('Gold & Catalog',            'Analytics Engineer',      'nb_gold_orchestrator  nb_catalog_sync'),
    ('AI & Advanced Analytics',   'Data Scientist',          'nb_ai_readiness  nb_fabric_agent_config'),
    ('Deploy & Operate',          'Platform Engineer',       'azure-pipelines  nb_bootstrap  nb_log_event'),
]

SPINE_TASKS = [
    # (line1, line2, line3)  — up to 3 tasks per activity
    ['Set up ConnectionConfig\n+ SCC credentials',
     'Choose auth: WI or SP\n(ADR-045)',
     'Define HWM watermark\n+ IngestionConfig rows'],
    ['Load Landing→Bronze\ndetect drift, quarantine',
     'Apply SCD strategy\nSCD0/1/2/fact/snap',
     'Fan-out per ObjectConfig\nmerge Silver, write Gold'],
    ['Flag PII columns\n(manual → auto GAP-08)',
     'Enforce TableContracts\n(Delta now, Pandera S8)',
     'Profile Bronze columns\n(GAP-07 Sprint 7)'],
    ['Detect dim/fact candidates\nnb_gold_candidate_detection',
     'Publish Gold for Direct Lake\nnb_view_factory + semantic model',
     'Register data products\nnb_data_product_catalog (GAP-10)'],
    ['Tag tables for AI\nIsAiTarget on GoldObject',
     'Configure Data Agent\nFabric native API (GAP-18)',
     'Resolve MDM entities\nrecordlinkage (GAP-15)'],
    ['Provision workspace + lakehouses\nnb_bootstrap  scripts/01-14',
     'Build + publish notebooks\nJupytext -> ipynb -> fab publish',
     'Monitor via RTI + Activator\nnb_log_event  KQL  Teams'],
]

# Stories per column per release band
# Each entry: (title_line, subtitle_line)  — empty string = no card
STORIES = {
    'done': [
        # Column 0: Connect & Ingest
        [('Configure JDBC source',             'nb_conn_jdbc  build_jdbc_connection'),
         ('Configure REST + pagination',        'nb_conn_rest  paginate + resolve_bearer_token'),
         ('Enable Workspace Identity auth',     'WI token path  build_jdbc_connection  GAP-01'),
         ('Mirror Azure SQL / Snowflake',       'nb_conn_mirror  CDC near-real-time  GAP-04'),
         ('Load files from ADLS / shortcut',   'nb_conn_file + nb_conn_shortcut'),
         ('Manage SCC lifecycle',               'nb_utils_scc  deploy_connections  ADR-044'),
         ('Connect Dataverse (SP)',             'nb_conn_dataverse  SP required  ADR-019'),
         ],
        # Column 1: Process & Enrich
        [('Load Landing files to Bronze',       'nb_landing_to_bronze  run_landing_to_bronze'),
         ('Detect + quarantine schema drift',   'detect_schema_drift  _write_quarantine'),
         ('Apply SCD-1 upsert to Silver',       'nb_silver_transform  apply_scd1'),
         ('Apply SCD-2 history tracking',       'nb_silver_transform  apply_scd2'),
         ('Apply fact / snapshot patterns',     'apply_fact_transaction  apply_fact_snapshot'),
         ('Generate Gold star schema',          'nb_gold_orchestrator + nb_create_dimdate'),
         ],
        # Column 2: Quality & Governance
        [('Flag PII columns manually',          'ObjectConfig.PiiColumns  manual entry'),
         ('Apply SHA-256 masking at Silver',    'nb_apply_masking  apply_masking'),
         ('Define cleansing rules (JSON)',      'ObjectConfig.CleansingRules  ADR-043'),
         ('Enforce Delta ADD CONSTRAINT',       'nb_bootstrap  static structural checks'),
         ('Quarantine drift rows',              '_write_quarantine  non-fatal isolation'),
         ],
        # Column 3: Gold & Catalog
        [('Detect Gold dim/fact candidates',    'nb_gold_candidate_detection  classify_column'),
         ('Generate dim/fact proposals',        'detect_dim_type  detect_fact_type'),
         ('Register Gold objects',              'control.GoldObject + GoldRelationship'),
         ('Build Direct Lake SQL views',        'nb_view_factory + nb_view_seeder'),
         ('Auto-register Bronze tables',        'nb_catalog_sync  infer_natural_key'),
         ],
        # Column 4: AI & Advanced Analytics
        [],   # nothing in sprints 1-6
        # Column 5: Deploy & Operate
        [('Provision lakehouses + Fabric SQL',  'nb_bootstrap  create_platform_lakehouses'),
         ('Inject WorkspaceGuid isolation',     'nb_orchestrator  build_dag  GAP-02'),
         ('Build .ipynb, publish to Fabric',    'Jupytext -> ipynb -> fab publish  ADR-032'),
         ('Run DAG-based pipeline',             'nb_orchestrator  run_pipeline  runMultiple'),
         ('Emit telemetry to RTI Eventstream',  'nb_log_event  _emit_to_eventstream  GAP-06'),
         ('Configure Spark resource profiles',  'apply_layer_spark_config  GAP-03'),
         ('Control plane: Fabric SQL DB',       'nb_utils_fabric_sql  CRUD DAL  GAP-05'),
         ],
    ],
    's7s8': [
        # Column 0: Connect & Ingest
        [('Use managed CDF->Eventstream connector', 'ADR-046 amend  RTI near-real-time  Apr26 GA'),
         ('Snowflake via OneLake shortcut',      'zero-copy  ADR-046 amend  shortcut vs Mirroring'),
         ],
        # Column 1: Process & Enrich
        [('Enable auto-compaction on Bronze',   'spark.conf autoCompact  ADR-056'),
         ],
        # Column 2: Quality & Governance
        [('Run whylogs Bronze profiling',       'nb_bronze_profiler  whylogs[spark]==1.6.*  GAP-07'),
         ('Log Bronze dataset to MLflow',       'mlflow.data.log_dataset  zero-cost complement'),
         ('Auto-scan PII with Presidio',        'nb_pii_scanner  presidio-analyzer 2.2.*  GAP-08'),
         ('Apply sensitivity labels post-scan', 'sempy bulk_set_labels  WAF-R2  EnvironmentConfig'),
         ('Store results: control.PiiScanResult', 'ADR-049  Fabric SQL  reviewed in notebook'),
         ('Enforce Pandera contracts at Silver', 'nb_data_quality_contracts  GAP-09 Sprint 8'),
         ('Build contract from TableContracts rows', 'pandera[pyspark]  dynamic schema'),
         ],
        # Column 3
        [],
        # Column 4
        [],
        # Column 5: Deploy & Operate
        [('Add pytest coverage gate to CI/CD',  'Build_And_Test  --cov-fail-under=80  TD-065'),
         ('Assert OAP active in scripts/11',    'TD-068  assert_oap_enabled()  WAF-R11'),
         ('Review LroConfig vs custom polling', 'TD-067  sempy 0.14.0  nb_orchestrator retry'),
         ],
    ],
    's9s10': [
        # Column 0
        [],
        # Column 1
        [],
        # Column 2: Quality & Governance
        [('View object-level lineage',          'IngestionSource -> ObjectConfig -> GoldObject'),
         ('Sync lineage to OpenMetadata',       'nb_openmetadata_sync  OpenLineage events'),
         ],
        # Column 3: Gold & Catalog
        [('Create control.DataProduct table',   'nb_bootstrap DDL  GAP-10 Sprint 9'),
         ('Register / update data product',     'nb_data_product_catalog  GAP-10'),
         ('Deploy DL model cross-workspace',    'sempy deploy_semantic_model  update_dl_connection'),
         ('Auto-generate model descriptions',   'Copilot Auto-Description  Apr26  GAP-10 metadata'),
         ('Browse catalog by domain (widget)',  'nb_widget_library  DynamicConfigEditor'),
         ('Sync catalog to OpenMetadata',       'nb_openmetadata_sync  GAP-11 Sprint 10'),
         ],
        # Column 4
        [],
        # Column 5
        [],
    ],
    'backlog': [
        # Column 0: Connect & Ingest
        [('Migrate bulk data with reconciliation', 'nb_migration_orchestrator  GAP-12'),
         ('Archive aged partitions',            'nb_archive_manager  cold tier  GAP-13'),
         ],
        # Column 1: Process & Enrich
        [('Apply Lakehouse pattern',            'GAP-19: medallion/vault/ODS/lambda/mesh'),
         ],
        # Column 2: Quality & Governance
        [('Configure OneLake access roles',     'scripts/20  deny-by-default  GAP-21'),
         ('Enable Purview scanning (opt-in)',   'scripts/18  ENABLE_PURVIEW  GAP-20'),
         ],
        # Column 3: Gold & Catalog
        [('Resolve MDM golden records',         'nb_mdm_engine  recordlinkage  GAP-15'),
         ('Provision domain workspaces',        'sempy create_domain + assign_domain_workspaces'),
         ],
        # Column 4: AI & Advanced Analytics
        [('Tag Gold tables for AI readiness',   'nb_ai_readiness_check  IsAiTarget  GAP-17'),
         ('Generate column embeddings',         'sentence-transformers  GAP-17'),
         ('Register Fabric Data Agent',         'nb_fabric_agent_config  GAP-18'),
         ('Wire Teams alert pipeline',          'Activator Path A / Graph API  GAP-16'),
         ('Evaluate agent quality with ragas',  'GAP-17  LLM output quality'),
         ],
        # Column 5: Deploy & Operate
        [('Migrate CI/CD to OIDC (WIF)',        'Workload Identity Federation  GAP-22'),
         ('OPTIMIZE via optimize_lakehouse_tables', 'sempy 0.14.0  GAP-23  Delta compaction'),
         ('set_fabric_runtime("2.0")',          'sempy 0.14.0  scripts/ provisioning'),
         ('Schedule VACUUM / V-Order',          'nb_table_maintenance  GAP-23'),
         ('Document DR topology + RTO/RPO',     'ADR-057  scripts/22  GAP-24'),
         ('Add ADO approval gate DEV -> UAT',   'Azure DevOps Environments  TD-066'),
         ],
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE
# ══════════════════════════════════════════════════════════════════════════════
fig, ax = plt.subplots(figsize=(24, 18))
fig.patch.set_facecolor(PAGE_BG)
ax.set_facecolor(PAGE_BG)
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')

# ── Title ─────────────────────────────────────────────────────────────────────
ax.text(0.5, 0.982,
        'Peggy   ·   Green Field Data Platform Toolset   ·   V-next User Story Map',
        fontsize=14, fontweight='bold', color=HEADER_COL,
        ha='center', va='center')
ax.text(0.5, 0.968,
        'Jeff Patton format   ·   Branch: claude/new-session-Jgqbi   ·   '
        'Gap closure: 381/390 (98%) complete   ·   '
        'V-next: Sprints 7-10 (GAP-07-11) + Backlog (GAP-12-25)   ·   2026-05-04',
        fontsize=7, color='#546E7A', ha='center', va='center')
ax.axhline(y=0.960, xmin=PAD, xmax=1 - PAD, color='#B0BEC5', lw=0.5)

# ── Column layout ─────────────────────────────────────────────────────────────
n_cols = len(ACTIVITIES)
col_total_w = 1 - 2 * PAD
col_w = (col_total_w - (n_cols - 1) * COL_GAP) / n_cols
col_xs = [PAD + i * (col_w + COL_GAP) for i in range(n_cols)]

# ── Activity backbone ─────────────────────────────────────────────────────────
y_act_top = 0.956
h_act = 0.090
y_act = y_act_top - h_act
for ci, (title, persona, nbs) in enumerate(ACTIVITIES):
    activity_card(ax, col_xs[ci], y_act, col_w, h_act, ci, title, persona, nbs)

# ── Spine tasks (walking skeleton) ────────────────────────────────────────────
h_spine = 0.120
y_spine = y_act - CARD_GAP - h_spine
for ci, tasks in enumerate(SPINE_TASKS):
    spine_card(ax, col_xs[ci], y_spine, col_w, h_spine, ci, tasks)

# ── Release bands ─────────────────────────────────────────────────────────────
DIV_H = 0.013

# Band heights proportional to story count
BAND_H = {
    'done':    0.200,
    's7s8':    0.165,
    's9s10':   0.135,
    'backlog': 0.150,
}

y_cursor = y_spine - CARD_GAP

BAND_ORDER = [
    ('done',    '[OK] DONE — Sprints 1-6  (GAP-01 through GAP-06 complete  ·  381/390 (98%))'),
    ('s7s8',    '[->] V-next  Sprint 7 (GAP-07 Bronze profiling + GAP-08 PII auto-discovery)  &  Sprint 8 (GAP-09 Pandera contracts)'),
    ('s9s10',   '[->] V-next  Sprint 9 (GAP-10 Data Product Catalogue)  &  Sprint 10 (GAP-11 OpenMetadata integration)'),
    ('backlog', '[..] Backlog  GAP-12 Migration  |  GAP-13 Archive  |  GAP-14 Mesh  |  GAP-15 MDM  |  GAP-16 Teams  |  GAP-17/18 AI  |  GAP-19-25'),
]

for release_key, div_label in BAND_ORDER:
    # Divider bar
    y_cursor -= DIV_H
    release_divider(ax, y_cursor, DIV_H, release_key, div_label)

    # Story cards
    band_h = BAND_H[release_key]
    y_band_top = y_cursor
    y_cursor -= band_h

    stories_by_col = STORIES[release_key]
    draw_columns(ax, col_xs, col_w, y_band_top, band_h, stories_by_col, release_key)

    # Light band background
    ec, band_bg, _ = REL[release_key]
    bbox(ax, PAD, y_cursor, 1 - 2 * PAD, band_h, ec, band_bg, lw=0.3,
         radius='round,pad=0.001', zorder=1)

# Column separator lines through story area
story_area_top = y_spine - CARD_GAP
story_area_bot = y_cursor
for ci in range(1, n_cols):
    lx = col_xs[ci] - COL_GAP / 2
    ax.plot([lx, lx], [story_area_bot, story_area_top],
            color='#CFD8DC', lw=0.4, zorder=2, linestyle='--')

# Activity column header lines (extend down)
for ci in range(n_cols):
    cx_mid = col_xs[ci] + col_w / 2
    ax.plot([cx_mid, cx_mid], [story_area_bot, y_act],
            color=ACT_EC[ci], lw=0.3, alpha=0.25, zorder=1)

# ── Legend ─────────────────────────────────────────────────────────────────────
ax.axhline(y=y_cursor - 0.002, xmin=PAD, xmax=1 - PAD, color='#B0BEC5', lw=0.4)
y_leg = max(0.002, y_cursor - 0.065)
h_leg = 0.050

legend_entries = [
    ('done',    '[OK]  Built — Sprints 1-6 complete',            STORY_EC['done'],    STORY_FC['done']),
    ('s7s8',    '[->]  Planned — V-next Sprint 7-8 (GAP-07-09)', STORY_EC['s7s8'],    STORY_FC['s7s8']),
    ('s9s10',   '[->]  Planned — V-next Sprint 9-10 (GAP-10-11)',STORY_EC['s9s10'],   STORY_FC['s9s10']),
    ('backlog', '[..]  Backlog — GAP-12 to GAP-25',              STORY_EC['backlog'], STORY_FC['backlog']),
]
lw = (1 - 2 * PAD - 3 * COL_GAP) / 4
for i, (_, lbl, ec, fc) in enumerate(legend_entries):
    lx = PAD + i * (lw + COL_GAP)
    bbox(ax, lx, y_leg, lw, h_leg, ec, fc, lw=1.2)
    bbox(ax, lx, y_leg, lw * 0.045, h_leg, ec, ec, lw=0, zorder=3)
    ax.text(lx + lw / 2, y_leg + h_leg / 2, lbl,
            fontsize=6.5, fontweight='bold', color='#1A1A1A',
            ha='center', va='center', zorder=4)

ax.text(0.5, y_leg - 0.012,
        'Activities (top) = Jeff Patton backbone  ·  Spine tasks = walking skeleton  ·  '
        'Release bands (horizontal) = delivery slices  ·  '
        'Story cards show notebook · function · ADR/GAP reference',
        fontsize=5, color='#90A4AE', ha='center', va='top')

# ── Save ──────────────────────────────────────────────────────────────────────
os.makedirs('docs/images', exist_ok=True)
for fmt in ('png', 'svg'):
    path = f'docs/images/story-map-vnext.{fmt}'
    plt.savefig(path, dpi=150, bbox_inches='tight',
                facecolor=PAGE_BG, edgecolor='none', format=fmt)
    print(f'Saved: {path}')
