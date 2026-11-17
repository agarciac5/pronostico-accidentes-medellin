from pathlib import Path

#rutas del proyecto.
BACKEND = Path(__file__).resolve().parents[1]

RUTA_DATAMART = BACKEND / "data" / "datamart" / "datamart_delta_urbanos"
RUTA_SALIDA = BACKEND / "data" / "processed" / "tabla_gradient_diaria"

from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

# Configurar Spark para trabajar localmente con tablas Delta.
builder = (
    SparkSession.builder
    .master("local[2]")
    .appName("PrepararTablaGradient")
    .config(
        "spark.sql.extensions",
        "io.delta.sql.DeltaSparkSessionExtension",
    )
    .config(
        "spark.sql.catalog.spark_catalog",
        "org.apache.spark.sql.delta.catalog.DeltaCatalog",
    )
    .config("spark.jars.ivy", "D:/Temporales/pi-datos/ivy")
    .config("spark.sql.shuffle.partitions", "4")
)

spark = configure_spark_with_delta_pip(builder).getOrCreate()

# Leer las tablas necesarias para contar incidentes por comuna y fecha.
hechos = spark.read.format("delta").load(
    str(RUTA_DATAMART / "fact_incidentes")
)

fechas = spark.read.format("delta").load(
    str(RUTA_DATAMART / "dim_fecha")
)

ubicaciones = spark.read.format("delta").load(
    str(RUTA_DATAMART / "dim_ubicacion")
)

# Revisar las columnas y sus tipos.
hechos.printSchema()
fechas.printSchema()
ubicaciones.printSchema()

# Relacionar cada incidente con su fecha y comuna.
detalle = (
    hechos
    .join(
        fechas.select("fecha_id", "fecha_completa"),
        on="fecha_id",
        how="left",
    )
    .join(
        ubicaciones.select("ubicacion_id", "comuna_id"),
        on="ubicacion_id",
        how="left",
    )
)

# Comprobar que todos los incidentes tengan fecha y comuna.
sin_referencia = detalle.filter(
    F.col("fecha_completa").isNull() | F.col("comuna_id").isNull()
)

if sin_referencia.limit(1).count() > 0:
    raise ValueError("Hay incidentes sin fecha o comuna en las dimensiones.")

# Contar los incidentes registrados por comuna y día.
conteos_diarios = (
    detalle
    .groupBy("comuna_id", "fecha_completa")
    .agg(F.sum("cantidad_incidentes").alias("conteo_observado"))
    .withColumnRenamed("fecha_completa", "fecha")
)

conteos_diarios.orderBy("fecha", "comuna_id").show(10)

# Crear las 16 comunas urbanas.
comunas = spark.range(1, 17).select(
    F.col("id").cast("int").alias("comuna_id")
)

# Tomar todas las fechas del calendario.
calendario = fechas.select(
    F.col("fecha_completa").alias("fecha")
)

# Crear una fila por cada combinación de comuna y fecha.
panel_diario = (
    comunas
    .crossJoin(calendario)
    .join(conteos_diarios, on=["comuna_id", "fecha"], how="left")
)

panel_diario.orderBy("fecha", "comuna_id").show(10)

# Leer el indicador de cobertura de la preparación anterior.
ruta_cobertura = BACKEND / "data" / "processed" / "serie_diaria.parquet"

cobertura = (
    spark.read.parquet(str(ruta_cobertura))
    .select(
        F.to_date("fecha").alias("fecha"),
        "fuente_con_registros_ciudad",
    )
    .distinct()
)

# Cada fecha debe tener un solo indicador.
if cobertura.count() != cobertura.select("fecha").distinct().count():
    raise ValueError("Hay indicadores de cobertura contradictorios para una fecha.")

panel_diario = panel_diario.join(cobertura, on="fecha", how="left")

if panel_diario.filter(F.col("fuente_con_registros_ciudad").isNull()).limit(1).count() > 0:
    raise ValueError("Falta información de cobertura para alguna fecha.")

# Cantidad de incidentes que aparecen en el archivo.
panel_diario = panel_diario.fillna({"conteo_observado": 0})

# Objetivo: conservar el conteo solo cuando hay registros municipales.
panel_diario = panel_diario.withColumn(
    "accidentes",
    F.when(
        F.col("fuente_con_registros_ciudad"),
        F.col("conteo_observado"),
    ),
)

panel_diario.filter(F.col("accidentes").isNull()).show(5)

# Variables conocidas antes de emitir el pronóstico.
panel_diario = (
    panel_diario
    .withColumn("dia_semana", F.dayofweek("fecha"))
    .withColumn("mes", F.month("fecha"))
)

panel_diario.select(
    "fecha", "comuna_id", "dia_semana", "mes", "accidentes"
).orderBy("fecha", "comuna_id").show(10)

# Separar las comunas y ordenar sus fechas.
ventana = Window.partitionBy("comuna_id").orderBy("fecha")
ultimos_7_dias = ventana.rowsBetween(-7, -1)

panel_diario = (
    panel_diario
    .withColumn("accidentes_ayer", F.lag("accidentes", 1).over(ventana))
    .withColumn("accidentes_hace_7_dias", F.lag("accidentes", 7).over(ventana))
    .withColumn("dias_validos_7", F.count("accidentes").over(ultimos_7_dias))
    .withColumn(
        "promedio_7_dias",
        F.when(
            F.col("dias_validos_7") == 7,
            F.avg("accidentes").over(ultimos_7_dias),
        ),
    )
)

panel_diario.select(
    "fecha", "comuna_id", "accidentes",
    "accidentes_ayer", "accidentes_hace_7_dias",
    "dias_validos_7", "promedio_7_dias",
).orderBy("fecha", "comuna_id").show(20)

# Comprobar que exista una sola fila por comuna y fecha.
total_filas = panel_diario.count()
filas_unicas = panel_diario.select("comuna_id", "fecha").distinct().count()
filas_esperadas = comunas.count() * calendario.count()

if total_filas != filas_unicas:
    raise ValueError("Hay filas repetidas para una misma comuna y fecha.")

if total_filas != filas_esperadas:
    raise ValueError("Faltan combinaciones de comuna y fecha.")

# Comprobar que los conteos conserven todos los incidentes.
total_incidentes = hechos.count()
total_observado = panel_diario.agg(
    F.sum("conteo_observado").alias("total")
).first()["total"]

if total_observado != total_incidentes:
    raise ValueError("Los conteos no coinciden con los incidentes del Data Mart.")

# Mostrar faltantes sin eliminarlos.
columnas_revisar = [
    "accidentes",
    "accidentes_ayer",
    "accidentes_hace_7_dias",
    "promedio_7_dias",
]

print(f"Filas del panel: {total_filas}")
print(f"Incidentes conservados: {total_observado}")

for columna in columnas_revisar:
    faltantes = panel_diario.filter(F.col(columna).isNull()).count()
    print(f"{columna}: {faltantes} valores nulos")

# Seleccionar las columnas finales.
columnas_salida = [
    "fecha", "comuna_id", "dia_semana", "mes",
    "conteo_observado", "fuente_con_registros_ciudad",
    "accidentes", "accidentes_ayer", "accidentes_hace_7_dias",
    "dias_validos_7", "promedio_7_dias",
]

tabla_gradient = panel_diario.select(*columnas_salida)

# Guardar sin reemplazar resultados anteriores.
tabla_gradient.write.mode("errorifexists").parquet(str(RUTA_SALIDA))

print(f"Tabla guardada en: {RUTA_SALIDA}")
spark.stop()