#!/usr/bin/env python3
"""
Generate Peggy V-next architecture infographic.
Run from repo root:  python scripts/generate_architecture_infographic.py
Output: docs/images/architecture-vnext.png  (and .svg)
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# ── Palette ──────────────────────────────────────────────────────────────────
BUILT_EC,   BUILT_FC   = '#1B5E20', '#E8F5E9'
PLANNED_EC, PLANNED_FC = '#BF360C', '#FBE9E7'
BACKLOG_EC, BACKLOG_FC = '#1565C0', '#E3F2FD'
MISSING_EC, MISSING_FC = '#880E4F', '#FCE4EC'
PARKED_EC,  PARKED_FC  = '#37474F', '#ECEFF1'
VNEXT_COL              = '#6A1B9A'
HEADER_COL             = '#0D47A1'
PAGE_BG                = '#F8F9FA'

STATUS = {
    'built':   (BUILT_EC,   BUILT_FC),
    'planned': (PLANNED_EC, PLANNED_FC),
    'backlog': (BACKLOG_EC, BACKLOG_FC),
    'missing': (MISSING_EC, MISSING_FC),
    'parked':  (PARKED_EC,  PARKED_FC),
}

SPRINT_COLORS = {
    'S7':  '#E65100',
    'S8':  '#4527A0',
    'S9':  '#006064',
    'S10': '#1B5E20',
}

PAD = 0.007
GAP = 0.004


def box(ax, x, y, w, h, status, title, sub='', badge='', lw=1.3):
    ec, fc = STATUS[status]
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle='round,pad=0.002',
        linewidth=lw, edgecolor=ec, facecolor=fc, zorder=2))
    # coloured left strip
    ax.add_patch(FancyBboxPatch(
        (x, y), w * 0.055, h, boxstyle='round,pad=0.001',
        linewidth=0, edgecolor=ec, facecolor=ec, zorder=3))
    tx = x + w * 0.085
    fs = max(4.5, min(7.0, h * 72 * 0.30))
    ax.text(tx, y + h * 0.63, title, fontsize=fs, fontweight='bold',
            color='#111111', ha='left', va='center', zorder=4, clip_on=True)
    if sub:
        ax.text(tx, y + h * 0.26, sub, fontsize=max(3.8, fs - 1.5),
                color='#555555', ha='left', va='center', zorder=4, clip_on=True)
    if badge:
        sprint_key = next((k for k in SPRINT_COLORS if k in badge), None)
        bc = SPRINT_COLORS[sprint_key] if sprint_key else (VNEXT_COL if '[PLAN]' in badge or '[BACK]' in badge else ec)
        # strip any remaining emoji to avoid missing-glyph warnings
        safe = badge.encode('ascii', 'replace').decode('ascii').replace('?', '?')
        ax.text(x + w - 0.003, y + h - 0.004, safe,
                fontsize=4.2, color=bc, fontweight='bold',
                ha='right', va='top', zorder=5, clip_on=True)


def hdr(ax, x, y, w, h, text, color=HEADER_COL, fs=6.5):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle='round,pad=0.003',
        linewidth=0, edgecolor=color, facecolor=color, zorder=2))
    ax.text(x + w / 2, y + h / 2, text, fontsize=fs, fontweight='bold',
            color='white', ha='center', va='center', zorder=3)


def section_lbl(ax, x, y, w, h, text):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle='round,pad=0.002',
        linewidth=1, edgecolor='#90A4AE', facecolor='#ECEFF1', zorder=2))
    ax.text(x + w / 2, y + h / 2, text, fontsize=5.5, fontweight='bold',
            color=HEADER_COL, ha='center', va='center', zorder=3)


# ── Figure ───────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(24, 16))
fig.patch.set_facecolor(PAGE_BG)
ax.set_facecolor(PAGE_BG)
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')

# ── Title ─────────────────────────────────────────────────────────────────────
ax.text(0.5, 0.978,
        'Peggy   ·   Green Field Data Platform Toolset   ·   V-next Planning Map',
        fontsize=14, fontweight='bold', color=HEADER_COL,
        ha='center', va='center')
ax.text(0.5, 0.963,
        'Branch: claude/new-session-Jgqbi   ·   Gap closure: 381/390 (98%) [OK]   ·   '
        'V-next: Sprints 7–10 + Backlog GAP-12–25   ·   '
        'April 2026 platform updates applied (OAP, CDF connector, sempy 0.14.0, Snowflake GA)   ·   2026-05-04',
        fontsize=7, color='#546E7A', ha='center', va='center')
ax.axhline(y=0.955, xmin=PAD, xmax=1 - PAD, color='#B0BEC5', lw=0.5)

# ═══════════════════════════════════════════════════════════════════
# AZURE RESOURCES
# ═══════════════════════════════════════════════════════════════════
y_az, h_az = 0.896, 0.052
section_lbl(ax, PAD, y_az, 0.080, h_az, 'AZURE\nRESOURCES')

az_items = [
    ('DevOps',         'azure-pipelines · 3-repo\nnb_smoke_assert',      'built',   'ADR-031/032/033 · GAP-22[->] OIDC · TD-066 ADO gate [..]'),
    ('Azure Security', 'WI nb_conn_jdbc/rest · OAP GA\nnb_utils_scc SCC lifecycle','built',   'ADR-044/045 · GAP-21[->] OneLake RBAC · TD-068 OAP [..]'),
    ('App Registration','scripts/02 SP\nOIDC WIF pending',               'built',   'ADR-045 · GAP-22[->] Workload Identity Federation'),
    ('Fabric Sub',     'nb_bootstrap DDL\nnb_capacity_scale · nb_var_lib','built',   'ADR-035/037'),
    ('OneExec',        '— unknown —\nno plan exists',                    'missing', '[?] needs architectural decision'),
    ('Databricks',     'Parked: Fabric-only\ncurrent delivery scope',    'parked',  '[P] ADR-000 explicit deferral'),
]
az_x0 = PAD + 0.082
az_total = 1 - az_x0 - PAD
az_w = (az_total - 5 * GAP) / 6
for i, (title, sub, status, badge) in enumerate(az_items):
    box(ax, az_x0 + i * (az_w + GAP), y_az, az_w, h_az, status, title, sub, badge)

# ═══════════════════════════════════════════════════════════════════
# MONITORING BAR
# ═══════════════════════════════════════════════════════════════════
y_mon, h_mon = 0.838, 0.050
section_lbl(ax, PAD, y_mon, 0.080, h_mon, 'MONITORING\n& DEPLOY')

mon_items = [
    ('Monitoring',      'nb_log_event · RTI Eventstream\nKQL PeggyTelemetry · CDF->Evtstream GA', 'built',   'ADR-041 · GAP-06[OK] · Apr26: schema-chg + WS metrics'),
    ('Live Deployment', 'azure-pipelines Bootstrap→Smoke\nnb_platform_bootstrapper',       'built',   'ADR-031/034 · TD-066 approval gate [..]'),
    ('Data Governance', 'nb_apply_masking · Presidio · bulk_set_labels\nSensitivity labels w/o Purview (sempy 0.14.0)', 'planned', 'ADR-053 · GAP-07/08 S7 · GAP-09 S8 · WAF-R2[->] sempy'),
    ('Teams Announce',  'Activator→Teams (Path A, zero-code)\nnb_conn_teams Graph (Path B)','planned', 'ADR-041 · GAP-16 [..] Backlog'),
]
mon_w = (az_total - 3 * GAP) / 4
for i, (title, sub, status, badge) in enumerate(mon_items):
    box(ax, az_x0 + i * (mon_w + GAP), y_mon, mon_w, h_mon, status, title, sub, badge)

# ═══════════════════════════════════════════════════════════════════
# MAIN SECTION — Inputs | 6 Service Columns | Outputs
# ═══════════════════════════════════════════════════════════════════
y_top, y_bot = 0.830, 0.265
h_main = y_top - y_bot  # 0.565

SIDE_W = 0.072

# ── Inputs ─────────────────────────────────────────────────────────
inp_x = PAD
section_lbl(ax, inp_x, y_bot, SIDE_W, h_main, 'INPUTS')
inp_items = [
    ('SAP',       'nb_conn_jdbc + nb_conn_rest\nJDBC HANA · OData',      'built', ''),
    ('Dataverse', 'nb_conn_dataverse\nSP required (WI not supported)',    'built', 'ADR-019/044'),
    ('P&O',       'nb_conn_rest / nb_conn_jdbc\nHR API endpoints',        'built', ''),
    ('Workday',   'nb_conn_rest paginate()\nRaaS API · HWM',              'built', ''),
    ('Azure',     'nb_conn_file · nb_conn_shortcut\nnb_utils_fabric',    'built', 'ADR-044/045'),
    ('Other Src', 'nb_conn_mirror + CDF->Evtstream GA\nSnowflake OneLake shortcut GA Apr26', 'built', 'ADR-046(amend) · GAP-04[OK] · Apr26'),
]
inp_h = (h_main - 5 * GAP) / 6
for i, (t, s, st, b) in enumerate(inp_items):
    iy = y_top - (i + 1) * inp_h - i * GAP
    box(ax, inp_x, iy, SIDE_W, inp_h, st, t, s, b, lw=1.0)

# ── Outputs ────────────────────────────────────────────────────────
out_x = 1 - PAD - SIDE_W
section_lbl(ax, out_x, y_bot, SIDE_W, h_main, 'OUTPUTS')
out_items = [
    ('Power BI',    'Gold Direct Lake · deploy_semantic_model\nnb_view_factory · Auto-Description Copilot','built',   'ADR-028/047 · GAP-10 DL CI/CD [OK] sempy 0.14.0'),
    ('Teams Alert', 'Activator native (Path A)\nGraph API SCC (Path B)',              'planned', 'GAP-16 [..] Backlog'),
    ('Copilot',     'Gold tables as source\nnb_utils_publish',                       'planned', 'GAP-17/18 [..] IsAiTarget'),
    ('AI Foundry',  'azure-ai-inference\nsemantic-kernel · mlflow',                  'planned', 'GAP-17/18 [..] Backlog'),
    ('License',     '— unclear intent —\nno GAP or ADR',                             'missing', '[?] needs scope decision'),
    ('Fabric APIs', 'nb_utils_fabric · nb_utils_scc\nscripts/11–14',                'built',   'ADR-044/046/047'),
]
out_h = inp_h
for i, (t, s, st, b) in enumerate(out_items):
    oy = y_top - (i + 1) * out_h - i * GAP
    box(ax, out_x, oy, SIDE_W, out_h, st, t, s, b, lw=1.0)

# ── Service columns ────────────────────────────────────────────────
svc_x0 = inp_x + SIDE_W + GAP
svc_x1 = out_x - GAP
svc_total = svc_x1 - svc_x0
n_cols = 6
col_w = (svc_total - (n_cols - 1) * GAP) / n_cols

# Section label spanning all 6 columns
section_lbl(ax, svc_x0, y_bot, svc_total, 0.009, 'DATA SERVICES LAYER')

COL_DEFS = [
    # (header, header_status, [(title, sub, status, badge), ...])
    ('Orchestration', 'built', [
        ('Clarity',         'nb_orchestrator  LroConfig\nbuild_dag · run_pipeline · TD-067', 'built',   'sempy 0.14.0 LroConfig'),
        ('Feature NB',      'full medallion chain\nsrc_to_landing → gold',      'built',   ''),
        ('Metadata Tables', 'db_control 13 tables\nnb_utils_fabric_sql CRUD',   'built',   'GAP-05[OK] S4–6'),
    ]),
    ('Data Quality', 'planned', [
        ('Clarity',         'nb_bronze_to_silver\nquarantine on drift',         'planned', 'GAP-09 S8'),
        ('Polyform NB',     'nb_data_quality_contracts\n(not yet built)',        'planned', 'GAP-09 S8'),
        ('Metadata',        'control.TableContracts\nObjectConfig DQ columns',  'built',   ''),
        ('Data Contracts',  'Delta constraints live\nPandera planned S8',       'planned', 'GAP-09 S8'),
        ('Web App',         'GAP-25: 3 paths\nPower BI / widget / FastAPI',     'backlog',  'GAP-25 [..]'),
    ]),
    ('Business Logic\n& Data Mapping', 'built', [
        ('Clarity',         'nb_silver_transform\nSCD0/1/2/fact/snap',          'built',   ''),
        ('Feature NB',      'nb_bronze_to_silver\nnb_register_object',          'built',   ''),
        ('Data Catalogue',  'nb_catalog_sync · nb_gold\n_candidate_detection',  'planned', 'GAP-10 S9'),
        ('Web App [OK]',      'nb_widget_library built\nDynamicConfigEditor NB',  'built',   'wire→GAP-10 S9'),
    ]),
    ('Enrichment', 'planned', [
        ('Cutover',         'nb_source_to_landing HWM\nnb_conn_mirror CDC',     'planned', 'GAP-12 [..]'),
        ('Feature NB',      'Silver transforms live\nnb_mdm_engine (planned)',   'planned', 'GAP-15/17 [..]'),
        ('Metadata',        'IngestionConfig\nObjectConfig WatermarkState',     'built',   ''),
        ('AI Foundry',      'azure-ai-inference\nsemantic-kernel planned',      'planned', 'GAP-17/18 [..]'),
    ]),
    ('Data Profiling', 'planned', [
        ('Cutover',         'nb_schema_explorer\nprofiling DDL exists',         'planned', 'GAP-07 S7'),
        ('Polyform NB',     'nb_bronze_profiler\nwhylogs[spark]==1.6.*  GAP-07','planned', 'GAP-07 S7 + mlflow.data'),
        ('Metadata',        'profiling.ColumnStats · BronzeProfile\nPiiScanResult · KeyCandidates', 'built', 'GAP-07/08 S7'),
        ('AI Foundry',      'Presidio + bulk_set_labels\nADR-049 · sensitivity labels S7','planned', 'GAP-08 S7 · WAF-R2'),
    ]),
    ('Data Product\nCatalogue', 'planned', [
        ('Catalogue',       'nb_catalog_sync\ncontrol.GoldObject live',         'planned', 'GAP-10 S9'),
        ('Feature NB',      'nb_data_product_catalog\n(not yet built)',          'planned', 'GAP-10 S9'),
        ('Data Catalogue',  'OpenMetadata or Purview UC\nADR-052 decides',      'planned', 'GAP-11 S10'),
        ('Web App',         'ADR-051 decides path\nanywidget or Fabric SDK',    'planned', 'GAP-10 S9'),
    ]),
]

for ci, (col_hdr, col_status, rows) in enumerate(COL_DEFS):
    cx = svc_x0 + ci * (col_w + GAP)
    ec, _ = STATUS[col_status]
    hdr(ax, cx, y_top - 0.036, col_w, 0.034, col_hdr, color=ec, fs=5.8)

    avail = h_main - 0.040
    rh = (avail - (len(rows) - 1) * GAP) / len(rows)
    for ri, (t, s, st, b) in enumerate(rows):
        ry = y_top - 0.040 - ri * (rh + GAP) - rh
        box(ax, cx, ry, col_w, rh, st, t, s, b, lw=0.9)

# ═══════════════════════════════════════════════════════════════════
# DATA STORAGE PATTERNS
# ═══════════════════════════════════════════════════════════════════
y_stor, h_stor = 0.112, 0.146
section_lbl(ax, PAD, y_stor, 0.080, h_stor, 'DATA STORAGE\nPATTERNS')

stor_items = [
    ('Medallion\nBronze→Silver→Gold', 'four lakehouses · notebook chain\nnb_landing→bronze→silver→gold',         'built',   'ADR-026/037 · GAP-02/03/05[OK]'),
    ('Data Migration\nTransfer 1→N',  'connectors ready\nnb_migration_orchestrator (planned)',                   'planned', 'ADR-038/046 · GAP-12 [..]'),
    ('Data Archive\nCold Path',        'OneLake cold tier planned\nnb_archive_manager (planned)',                 'planned', 'GAP-13 [..]'),
    ('Data Mesh\nDomain topology',    'OneLake Shortcuts live · Domains API\ncreate_domain() sempy 0.14.0 admin', 'planned', 'ADR-037 · GAP-14 [..] · sempy admin'),
    ('Lakestore\nHot/Warm/Cold',      'RTI Eventstream hot path [OK]\nbatch Bronze [OK] · cold path planned',        'planned', 'ADR-041 · GAP-06[OK] · GAP-13/19 [..]'),
    ('Data Warehouse\nStar Schema',   'Gold star schema + dimdate live\nFabric Warehouse alt: ADR-037',          'backlog',  'ADR-037/047 · GAP-19 [..]'),
]
sx0 = PAD + 0.082
st_total = 1 - sx0 - PAD
st_w = (st_total - 5 * GAP) / 6
for i, (t, s, st, b) in enumerate(stor_items):
    box(ax, sx0 + i * (st_w + GAP), y_stor, st_w, h_stor, st, t, s, b, lw=1.2)

# ═══════════════════════════════════════════════════════════════════
# LEGEND
# ═══════════════════════════════════════════════════════════════════
ax.axhline(y=0.107, xmin=PAD, xmax=1 - PAD, color='#B0BEC5', lw=0.5)
y_leg = 0.008
h_leg = 0.092

legend_items = [
    ('built',   '[BUILT]  Built  (Sprints 1–6 complete)'),
    ('planned', '[PLAN]   Planned  (V-next Sprints 7–10)'),
    ('backlog', '[BACK]   Backlog  (GAP-12–25, prioritised)'),
    ('missing', '[?]      No plan  (decision required)'),
    ('parked',  '[PARK]   Parked  (explicit deferral)'),
]
lw_each = (1 - 2 * PAD - 4 * GAP) / 5
for i, (st, lbl) in enumerate(legend_items):
    lx = PAD + i * (lw_each + GAP)
    ec, fc = STATUS[st]
    ax.add_patch(FancyBboxPatch(
        (lx, y_leg + 0.028), lw_each, 0.048,
        boxstyle='round,pad=0.003', linewidth=1.5, edgecolor=ec, facecolor=fc, zorder=2))
    ax.add_patch(FancyBboxPatch(
        (lx, y_leg + 0.028), lw_each * 0.06, 0.048,
        boxstyle='round,pad=0.001', linewidth=0, edgecolor=ec, facecolor=ec, zorder=3))
    ax.text(lx + lw_each / 2, y_leg + 0.052, lbl,
            fontsize=6.5, fontweight='bold', color='#1A1A1A',
            ha='center', va='center', zorder=4)

# Sprint colour key
sprint_labels = [
    ('S7', 'Sprint 7 · GAP-07/08\nBronze profiling + PII'),
    ('S8', 'Sprint 8 · GAP-09\nPandera contracts'),
    ('S9', 'Sprint 9 · GAP-10\nData Product Catalogue'),
    ('S10', 'Sprint 10 · GAP-11\nOpenMetadata'),
]
sw = (1 - 2 * PAD - 3 * GAP) / 4
for i, (key, lbl) in enumerate(sprint_labels):
    sx = PAD + i * (sw + GAP)
    color = SPRINT_COLORS[key]
    ax.add_patch(FancyBboxPatch(
        (sx, y_leg), sw, 0.022,
        boxstyle='round,pad=0.002', linewidth=1, edgecolor=color, facecolor=color + '22', zorder=2))
    ax.text(sx + sw / 2, y_leg + 0.011, lbl,
            fontsize=5.2, color=color, fontweight='bold',
            ha='center', va='center', zorder=3)

# Footer
ax.text(0.5, y_leg - 0.006,
        'Enabler project · all notebooks source-agnostic and parameterised · '
        'client provides: ConnectionConfig credentials, RunbookStep DAG, ObjectConfig seed rows, ViewScript SQL · '
        'WAF assessment: docs → ms-best-practice-assessment.md · '
        'Full coverage map: __inbox/__todo/20260504/architecture-slide-coverage-map.md',
        fontsize=4.8, color='#90A4AE', ha='center', va='top', zorder=5)

# ── Save ──────────────────────────────────────────────────────────────────────
os.makedirs('docs/images', exist_ok=True)
plt.tight_layout(pad=0)
for fmt in ('png', 'svg'):
    path = f'docs/images/architecture-vnext.{fmt}'
    plt.savefig(path, dpi=150, bbox_inches='tight',
                facecolor=PAGE_BG, edgecolor='none', format=fmt)
    print(f'Saved: {path}')
