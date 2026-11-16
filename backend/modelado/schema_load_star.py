"""
Transforma los datos residentes en archivos parquet debidamente procesados luego de Medallion al esquema estrella (dw.*).

El proceso es ELT: los datos ya están en PostgreSQL, así que cada paso es un
INSERT ... SELECT que lee de oltp.* y escribe en dw.*.

Uso: python labs/01-modelado/load_star.py

Antes de ejecutarlo debes:
  1. Completar los TODO de sql/star_schema.sql
  2. Completar los TODO de este archivo (SQL_DIM_*, SQL_FACT)
Al final se ejecuta verify(), que valida tu carga. No lo modifiques.
"""

# Esta línea descarga y conecta automáticamente los archivos .jar de Delta Lake con Java

from delta import configure_spark_with_delta_pip
from delta.tables import DeltaTable
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType

# Configura el builder de Spark con las extensiones de Delta
builder = (
    SparkSession.builder.appName("CargaDataMart")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config(
        "spark.sql.catalog.spark_catalog",
        "org.apache.spark.sql.delta.catalog.DeltaCatalog",
    )
)

# Crea la sesión conectando los archivos .jar de Delta Lake
spark = configure_spark_with_delta_pip(builder).getOrCreate()

# 1. Inicializar Spark con soporte para Delta Lake
spark = SparkSession.builder \
    .appName("ETL_Incremental_Incidentes") \
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
    .getOrCreate()

ruta_nuevo_lote = "backend/data/processed/incidentes_puntos_candidatos.parquet"
ruta_datamart = "backend/data/datamart/datamart_delta"

# Función auxiliar para hacer MERGE (solo inserta si la llave no existe)
def upsert_delta(df_nuevos, ruta_tabla, columna_llave):
    if DeltaTable.isDeltaTable(spark, ruta_tabla):
        tabla_destino = DeltaTable.forPath(spark, ruta_tabla)
        tabla_destino.alias("destino").merge(
            df_nuevos.alias("origen"),
            f"destino.{columna_llave} = origen.{columna_llave}"
        ).whenNotMatchedInsertAll().execute()
    else:
        # Si es la primera ejecución, crea la tabla Delta
        df_nuevos.write.format("delta").save(ruta_tabla)

# 2. Leer y limpiar el nuevo lote de datos
df_raw = spark.read.parquet(ruta_nuevo_lote)

df_clean = df_raw \
    .withColumn("clase", F.trim(F.upper(F.col("clase")))) \
    .withColumn("gravedad", F.trim(F.upper(F.col("gravedad")))) \
    .withColumn("fecha_solo", F.to_date(F.col("fecha"))) \
    .withColumn("lat_redondeada", F.round(F.col("latitud"), 4)) \
    .withColumn("lon_redondeada", F.round(F.col("longitud"), 4))

# ==============================================================================
# 3. ACTUALIZACIÓN INCREMENTAL DE DIMENSIONES
# ==============================================================================

# --- DIM_FECHA ---
dim_fecha_batch = df_clean.select("fecha_solo").distinct() \
    .withColumn("fecha_id", F.date_format("fecha_solo", "yyyyMMdd").cast(IntegerType())) \
    .withColumn("anio", F.year("fecha_solo")) \
    .withColumn("mes", F.month("fecha_solo")) \
    .withColumn("dia", F.dayofmonth("fecha_solo")) \
    .withColumn("dia_semana_num", F.dayofweek("fecha_solo")) \
    .withColumn("es_fin_de_semana", F.when(F.col("dia_semana_num").isin(1, 7), True).otherwise(False)) \
    .withColumnRenamed("fecha_solo", "fecha_completa")

upsert_delta(dim_fecha_batch, f"{ruta_datamart}/dim_fecha", "fecha_id")

# --- DIM_HORA ---
dim_hora_batch = df_clean.select(F.col("hora").cast(IntegerType()).alias("hora_id")).distinct() \
    .withColumn("franja_horaria", 
        F.when((F.col("hora_id") >= 0) & (F.col("hora_id") <= 5), "MADRUGADA")
         .when((F.col("hora_id") >= 6) & (F.col("hora_id") <= 11), "MAÑANA")
         .when((F.col("hora_id") >= 12) & (F.col("hora_id") <= 17), "TARDE")
         .otherwise("NOCHE")
    ) \
    .withColumn("es_hora_pico", 
        F.when(F.col("hora_id").isin(7, 8, 12, 13, 17, 18, 19), True).otherwise(False)
    )

upsert_delta(dim_hora_batch, f"{ruta_datamart}/dim_hora", "hora_id")

# --- DIM_TIPO_INCIDENTE ---
dim_tipo_batch = df_clean.select("clase", "gravedad").distinct() \
    .withColumn("tipo_incidente_id", F.sha2(F.concat_ws("||", "clase", "gravedad"), 256)) \
    .select("tipo_incidente_id", "clase", "gravedad")

upsert_delta(dim_tipo_batch, f"{ruta_datamart}/dim_tipo_incidente", "tipo_incidente_id")

# --- DIM_UBICACION ---
dim_ubicacion_batch = df_clean.select("comuna_id", "lat_redondeada", "lon_redondeada").distinct() \
    .withColumn("ubicacion_id", F.sha2(F.concat_ws("||", "comuna_id", "lat_redondeada", "lon_redondeada"), 256)) \
    .withColumnRenamed("lat_redondeada", "latitud") \
    .withColumnRenamed("lon_redondeada", "longitud") \
    .select("ubicacion_id", "comuna_id", "latitud", "longitud")

upsert_delta(dim_ubicacion_batch, f"{ruta_datamart}/dim_ubicacion", "ubicacion_id")

# ==============================================================================
# 4. ACTUALIZACIÓN INCREMENTAL DE LA TABLA DE HECHOS
# ==============================================================================

# Generamos un hash único por fila para evitar duplicados si se reprocesa un archivo
fact_batch = df_clean \
    .withColumn("fecha_id", F.date_format("fecha_solo", "yyyyMMdd").cast(IntegerType())) \
    .withColumn("hora_id", F.col("hora").cast(IntegerType())) \
    .withColumn("tipo_incidente_id", F.sha2(F.concat_ws("||", "clase", "gravedad"), 256)) \
    .withColumn("ubicacion_id", F.sha2(F.concat_ws("||", "comuna_id", "lat_redondeada", "lon_redondeada"), 256)) \
    .withColumn("incidente_id", F.sha2(F.concat_ws("||", "fecha", "hora", "clase", "gravedad", "comuna_id", "latitud", "longitud"), 256)) \
    .withColumn("cantidad_incidentes", F.lit(1)) \
    .select(
        "incidente_id",
        "fecha_id",
        "hora_id",
        "tipo_incidente_id",
        "ubicacion_id",
        "cantidad_incidentes"
    ).dropDuplicates(["incidente_id"])

# Usamos MERGE en la tabla de hechos para garantizar idempotencia
upsert_delta(fact_batch, f"{ruta_datamart}/fact_incidentes", "incidente_id")

print("Carga incremental finalizada con éxito.")
