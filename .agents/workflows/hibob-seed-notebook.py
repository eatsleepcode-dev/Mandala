# ---
# title: HiBob API - Live Seed Data Update
# description: >
#   PySpark cells to seed control tables with HiBob API configuration.
#   Idempotent MERGE statements - safe to run multiple times on deployed Control LH.
#   Run these cells in a Fabric notebook attached to db_control.
# ---

# ══════════════════════════════════════════════════════════════════════════════
# Cell 1: Add AuthMode column to ConnectionConfig (if not exists)
# ══════════════════════════════════════════════════════════════════════════════

control_lh = "db_control"

# Check if AuthMode column exists
columns = spark.sql(f"DESCRIBE {control_lh}.control.ConnectionConfig").collect()
has_auth_mode = any(row.col_name == "AuthMode" for row in columns)

if not has_auth_mode:
    print("Adding AuthMode column to ConnectionConfig...")
    spark.sql(f"""
        ALTER TABLE {control_lh}.control.ConnectionConfig
        ADD COLUMN AuthMode STRING
    """)
    print("✓ AuthMode column added")
else:
    print("✓ AuthMode column already exists")


# ══════════════════════════════════════════════════════════════════════════════
# Cell 2: Seed IngestionSource - HIBOB_API
# ══════════════════════════════════════════════════════════════════════════════

from pyspark.sql import Row

src_df = spark.createDataFrame([Row(
    SourceID=300,
    SourceName="HIBOB_API",
    SourceType="REST",
    CreatedDate="2026-04-23T00:00:00Z"
)])
src_df.createOrReplaceTempView("_hibob_src")

spark.sql(f"""
    MERGE INTO {control_lh}.control.IngestionSource tgt
    USING _hibob_src src
    ON tgt.SourceID = src.SourceID
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")

print("✓ IngestionSource seeded for HiBob API")


# ══════════════════════════════════════════════════════════════════════════════
# Cell 3: Seed ConnectionConfig - HiBob Service User
# ══════════════════════════════════════════════════════════════════════════════

conn_df = spark.createDataFrame([Row(
    ConnectionID=3,
    SourceID=300,
    KeyVaultSecretName="kv-hibob-service-user",
    ConnectionString=None,
    FabricConnectionId=None,
    PaginationMode="SINGLE",
    DataKey="employees",
    JdbcDriver=None,
    AbfssPath=None,
    BaseUrl="https://api.hibob.com/v1",
    AuthMode="BASIC"
)])
conn_df.createOrReplaceTempView("_hibob_conn")

spark.sql(f"""
    MERGE INTO {control_lh}.control.ConnectionConfig tgt
    USING _hibob_conn src
    ON tgt.ConnectionID = src.ConnectionID
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")

print("✓ ConnectionConfig seeded for HiBob API")


# ══════════════════════════════════════════════════════════════════════════════
# Cell 4: Seed IngestionConfig - profiles endpoint
# ══════════════════════════════════════════════════════════════════════════════

cfg_df = spark.createDataFrame([Row(
    ConfigID=300,
    SourceID=300,
    ObjectName="profiles",
    WatermarkColumn=None,
    SyncType="FULL",
    SourcePath=None,
    FileFormat=None,
    RelativeUrl=None,
    Method="GET",
    PaginationRules=None,
    CustomQuery=None,
    RequiresNotebook=False
)])
cfg_df.createOrReplaceTempView("_hibob_cfg")

spark.sql(f"""
    MERGE INTO {control_lh}.control.IngestionConfig tgt
    USING _hibob_cfg src
    ON tgt.ConfigID = src.ConfigID
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")

print("✓ IngestionConfig seeded for HiBob profiles endpoint")


# ══════════════════════════════════════════════════════════════════════════════
# Cell 5: Verification - Display HiBob configuration
# ══════════════════════════════════════════════════════════════════════════════

result = spark.sql(f"""
    SELECT 
        s.SourceID,
        s.SourceName,
        s.SourceType,
        c.ConnectionID,
        c.BaseUrl,
        c.AuthMode,
        c.PaginationMode,
        c.DataKey,
        c.KeyVaultSecretName,
        ic.ConfigID,
        ic.ObjectName,
        ic.SyncType
    FROM   {control_lh}.control.IngestionSource s
    JOIN   {control_lh}.control.ConnectionConfig c USING (SourceID)
    JOIN   {control_lh}.control.IngestionConfig ic USING (SourceID)
    WHERE  s.SourceID = 300
""")

display(result)
print("\n✓ HiBob API configuration complete!")
print("  Next steps:")
print("  1. Ensure Key Vault secret 'kv-hibob-service-user' is set to 'ServiceUserId:Token'")
print("  2. Run nb_conn_rest with ConfigID=300 to test ingestion")
print("  3. Check Landing lakehouse for profiles data under HIBOB_API/profiles/")
