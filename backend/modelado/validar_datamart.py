import os
from delta import configure_spark_with_delta_pip
from delta.tables import DeltaTable
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

# 1. Inicia Spark con Delta Lake
builder = (
    SparkSession.builder.appName("ValidarDataMart")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config(
        "spark.sql.catalog.spark_catalog",
        "org.apache.spark.sql.delta.catalog.DeltaCatalog",
    )
)
spark = configure_spark_with_delta_pip(builder).getOrCreate()
spark.sparkContext.setLogLevel("ERROR")  # Oculta advertencias para ver limpio el resultado

# 2. Define la ruta base de tu Data Mart (ajusta si usas otra carpeta)
ruta_datamart = "backend/data/datamart/datamart_delta_urbanos"
tablas = ["dim_fecha", "dim_hora", "dim_tipo_incidente", "dim_ubicacion", "fact_incidentes"]  # Agrega aquí el resto de tus dimensiones y tabla de hechos

for tabla in tablas:
    ruta_tabla = os.path.join(ruta_datamart, tabla)
    print(f"\n{'='*50}")
    print(f"VALIDANDO TABLA: {tabla}")
    print(f"{'='*50}")

    # Verifica que sea una tabla Delta válida
    if not DeltaTable.isDeltaTable(spark, ruta_tabla):
        raise ValueError(f"No se encontró una tabla Delta en {ruta_tabla}")

    # Lee la tabla Delta
    df = spark.read.format("delta").load(ruta_tabla)

    # A. Conteo total de filas
    total_filas = df.count()
    print(f"Total de registros: {total_filas}")

    # B. Esquema y tipos de datos
    print("\nEstructura de columnas:")
    df.printSchema()

    # C. Muestra de las primeras 5 filas
    print("Primeros 5 registros:")
    df.show(5, truncate=False)

    # D. Conteo de valores nulos por columna
    print("Conteo de nulos por columna:")
    df.select([F.count(F.when(F.col(c).isNull(), c)).alias(c) for c in df.columns]).show()

    # E. Historial de versiones Delta (auditoría de cargas)
    print("Últimas versiones registradas en el log de Delta:")
    dt = DeltaTable.forPath(spark, ruta_tabla)
    dt.history(3).select("version", "timestamp", "operation", "operationMetrics").show(truncate=False)

spark.stop()
