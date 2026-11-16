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
    SparkSession.builder
    .master("local[2]")
    .appName("CargaDataMart")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config(
        "spark.sql.catalog.spark_catalog",
        "org.apache.spark.sql.delta.catalog.DeltaCatalog",
    )
    .config("spark.jars.ivy", "D:/Temporales/pi-datos/ivy")
    .config("spark.sql.shuffle.partitions", "4")
)

# Crea la sesión conectando los archivos .jar de Delta Lake
spark = configure_spark_with_delta_pip(builder).getOrCreate()

ruta_nuevo_lote = "backend/data/interim/incidentes_urbanos.parquet"
ruta_datamart = "backend/data/datamart/datamart_delta_urbanos"

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

def validar_clave(tabla, clave, nombre):
    clave_vacia = (
        F.col(clave).isNull()
        | (F.trim(F.col(clave).cast("string")) == "")
    )
    if tabla.filter(clave_vacia).limit(1).count() > 0:
        raise ValueError(f"{nombre}: hay claves vacías.")

    total_filas = tabla.count()
    claves_distintas = tabla.select(clave).distinct().count()
    if claves_distintas != total_filas:
        raise ValueError(f"{nombre}: hay claves repetidas. Revisar antes de cargar.")


# 2. Leer y limpiar el nuevo lote de datos
df_raw = spark.read.parquet(ruta_nuevo_lote)
validar_clave(df_raw, "llave", "Incidentes de entrada")

df_clean = df_raw \
    .withColumn("clase", F.trim(F.upper(F.col("clase")))) \
    .withColumn("gravedad", F.trim(F.upper(F.col("gravedad")))) \
    .withColumn("fecha_solo", F.to_date(F.col("fecha"))) \
    .withColumn("coordenadas_revisables", F.coalesce(F.col("coordenadas_revisables"), F.lit(False))) \
    .withColumn("lat_redondeada", F.when(F.col("coordenadas_revisables"), F.round(F.col("latitud"), 4))) \
    .withColumn("lon_redondeada", F.when(F.col("coordenadas_revisables"), F.round(F.col("longitud"), 4)))

# Sin un punto utilizable conservamos una ubicación por comuna, con coordenadas nulas.
# La clave se calcula una sola vez para compartirla entre dimensión y hechos.
# El indicador proviene del control preliminar; no certifica la ubicación real.
df_clean = df_clean.withColumn(
    "ubicacion_id",
    F.sha2(
        F.concat_ws(
            "||",
            F.col("comuna_id").cast("string"),
            F.coalesce(F.col("lat_redondeada").cast("string"), F.lit("SIN_COORDENADAS")),
            F.coalesce(F.col("lon_redondeada").cast("string"), F.lit("SIN_COORDENADAS")),
        ),
        256,
    ),
)

# ==============================================================================
# 3. ACTUALIZACIÓN INCREMENTAL DE DIMENSIONES
# ==============================================================================

# --- DIM_FECHA ---
# Periodo de la preparación actual; no define los cortes de entrenamiento.
fecha_inicio = "2021-01-01"
fecha_fin = "2025-08-31"

# Incluir todas las fechas no implica que los días sin cobertura tengan cero incidentes.
fechas = F.sequence(
    F.to_date(F.lit(fecha_inicio)),
    F.to_date(F.lit(fecha_fin)),
    F.expr("INTERVAL 1 DAY"),
)
calendario = spark.range(1).select(
    F.explode(fechas).alias("fecha_completa")
)

dim_fecha_batch = (
    calendario
    .withColumn(
        "fecha_id",
        F.date_format("fecha_completa", "yyyyMMdd").cast(IntegerType()),
    )
    .withColumn("anio", F.year("fecha_completa"))
    .withColumn("mes", F.month("fecha_completa"))
    .withColumn("dia", F.dayofmonth("fecha_completa"))
    .withColumn("dia_semana_num", F.dayofweek("fecha_completa"))
    .withColumn("es_fin_de_semana", F.col("dia_semana_num").isin(1, 7))
)

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

# --- DIM_TIPO_INCIDENTE ---
dim_tipo_batch = df_clean.select("clase", "gravedad").distinct() \
    .withColumn("tipo_incidente_id", F.sha2(F.concat_ws("||", "clase", "gravedad"), 256)) \
    .select("tipo_incidente_id", "clase", "gravedad")

# --- DIM_UBICACION ---
dim_ubicacion_batch = df_clean.select(
    "ubicacion_id", "comuna_id", "lat_redondeada", "lon_redondeada", "coordenadas_revisables"
).distinct() \
    .withColumnRenamed("lat_redondeada", "latitud") \
    .withColumnRenamed("lon_redondeada", "longitud") \
    .select("ubicacion_id", "comuna_id", "latitud", "longitud", "coordenadas_revisables")

# ==============================================================================
# 4. ACTUALIZACIÓN INCREMENTAL DE LA TABLA DE HECHOS
# ==============================================================================

# Conservamos la llave original para identificar cada incidente.
fact_batch = df_clean \
    .withColumn("fecha_id", F.date_format("fecha_solo", "yyyyMMdd").cast(IntegerType())) \
    .withColumn("hora_id", F.col("hora").cast(IntegerType())) \
    .withColumn("tipo_incidente_id", F.sha2(F.concat_ws("||", "clase", "gravedad"), 256)) \
    .withColumn("incidente_id", F.col("llave").cast("string")) \
    .withColumn("cantidad_incidentes", F.lit(1)) \
    .select(
        "incidente_id",
        "fecha_id",
        "hora_id",
        "tipo_incidente_id",
        "ubicacion_id",
        "cantidad_incidentes"
    )

# Validar antes de escribir cualquier tabla.
total_entrada = df_raw.count()
total_hechos = fact_batch.count()

if total_hechos != total_entrada:
    raise ValueError(
        f"No coinciden los conteos: entrada={total_entrada}, hechos={total_hechos}."
    )

validar_clave(fact_batch, "incidente_id", "Hechos")

dimensiones = [
    ("fecha", dim_fecha_batch, "fecha_id"),
    ("hora", dim_hora_batch, "hora_id"),
    ("tipo", dim_tipo_batch, "tipo_incidente_id"),
    ("ubicacion", dim_ubicacion_batch, "ubicacion_id"),
]

for nombre, dimension, clave in dimensiones:
    validar_clave(dimension, clave, nombre)

    # Cada hecho debe encontrar su fila en la dimensión.
    sin_referencia = fact_batch.join(
        dimension.select(clave), on=clave, how="left_anti"
    )
    if sin_referencia.limit(1).count() > 0:
        raise ValueError(
            f"Hay incidentes sin referencia válida en la dimensión {nombre}."
        )

# Guardar las tablas después de superar los controles.
upsert_delta(dim_fecha_batch, f"{ruta_datamart}/dim_fecha", "fecha_id")
upsert_delta(dim_hora_batch, f"{ruta_datamart}/dim_hora", "hora_id")
upsert_delta(dim_tipo_batch, f"{ruta_datamart}/dim_tipo_incidente", "tipo_incidente_id")
upsert_delta(dim_ubicacion_batch, f"{ruta_datamart}/dim_ubicacion", "ubicacion_id")
upsert_delta(fact_batch, f"{ruta_datamart}/fact_incidentes", "incidente_id")

print("Carga incremental finalizada con éxito.")
