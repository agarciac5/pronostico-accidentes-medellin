from pathlib import Path
import pandas as pd
import holidays

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import GradientBoostingRegressor

BACKEND = Path(__file__).resolve().parents[1]
RUTA_DATOS = BACKEND / "data" / "processed" / "tabla_gradient_diaria"

# Leer la tabla pequeña que preparamos con Spark.
datos = pd.read_parquet(RUTA_DATOS)
datos["fecha"] = pd.to_datetime(datos["fecha"])
festivos = holidays.Colombia(years=datos["fecha"].dt.year.unique().tolist())
datos["es_festivo"] = datos["fecha"].dt.date.isin(festivos.keys()).astype(int)
datos = datos.sort_values(["fecha", "comuna_id"])

variables = [
    "comuna_id", "dia_semana", "mes", "es_festivo",
    "accidentes_ayer", "accidentes_hace_7_dias", "promedio_7_dias",
]

# Separar por fechas, sin mezclar aleatoriamente.
entrenamiento = datos.loc[
    datos["fecha"].between("2022-07-01", "2024-08-31")
].copy()

validacion = datos.loc[
    datos["fecha"].between("2024-09-01", "2024-12-31")
].copy()

# Informar cuántas filas tienen todos los valores necesarios.
for nombre, tabla in [
    ("Entrenamiento", entrenamiento),
    ("Validación", validacion),
]:
    completas = tabla.dropna(subset=variables + ["accidentes"])
    print(
        f"{nombre}: {len(tabla)} filas; "
        f"{len(completas)} completas; "
        f"{len(tabla) - len(completas)} excluidas por faltantes."
    )

entrenamiento = entrenamiento.dropna(subset=variables + ["accidentes"])
validacion = validacion.dropna(subset=variables + ["accidentes"])

# Separar categorías y cantidades.
categoricas = ["comuna_id", "dia_semana", "mes"]
numericas = [
    "accidentes_ayer",
    "accidentes_hace_7_dias",
    "promedio_7_dias",
    "es_festivo",
]

preparacion = ColumnTransformer([
    (
        "categorias",
        OneHotEncoder(handle_unknown="ignore", sparse_output=False),
        categoricas,
    ),
    ("numeros", "passthrough", numericas),
])

# Unir la preparación y el modelo.
modelo = Pipeline([
    ("preparacion", preparacion),
    ("gradient", GradientBoostingRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=3,
        random_state=42,
    )),
])
# Separar las variables de entrada y el objetivo.
X_train = entrenamiento[variables]
y_train = entrenamiento["accidentes"]

X_valid = validacion[variables]
y_valid = validacion["accidentes"]

# Entrenar únicamente con el periodo de entrenamiento.
modelo.fit(X_train, y_train)

# Predecir el periodo de validación.
predicciones = modelo.predict(X_valid)

# Organizar los resultados para compararlos.
resultados = validacion[["fecha", "comuna_id", "accidentes"]].copy()
resultados["prediccion"] = predicciones
resultados["referencia_semanal"] = validacion["accidentes_hace_7_dias"]
resultados["referencia_promedio"] = validacion["promedio_7_dias"]

print(resultados.head(10))
print("Predicciones negativas:", (resultados["prediccion"] < 0).sum())

# Comparar el modelo con las dos referencias.
metricas = []

for nombre, columna in [
    ("Gradient boosting", "prediccion"),
    ("Referencia semanal", "referencia_semanal"),
    ("Promedio últimos 7 días", "referencia_promedio"),
]:
    errores = resultados[columna] - resultados["accidentes"]

    metricas.append({
        "modelo": nombre,
        "MAE": errores.abs().mean(),
        "RMSE": (errores.pow(2).mean()) ** 0.5,
        "sesgo": errores.mean(),
    })

print("\nResultados de validación de 2024:")
print(pd.DataFrame(metricas).round(3).to_string(index=False))

# Comparar los errores de los tres métodos dentro de cada comuna.
metricas_por_comuna = []

for comuna, grupo in resultados.groupby("comuna_id"):
    for nombre, columna in [
        ("Gradient boosting", "prediccion"),
        ("Referencia semanal", "referencia_semanal"),
        ("Promedio últimos 7 días", "referencia_promedio"),
    ]:
        errores = grupo[columna] - grupo["accidentes"]

        metricas_por_comuna.append({
            "comuna_id": comuna,
            "modelo": nombre,
            "dias_evaluados": len(grupo),
            "promedio_observado": grupo["accidentes"].mean(),
            "MAE": errores.abs().mean(),
            "RMSE": errores.pow(2).mean() ** 0.5,
            "sesgo": errores.mean(),
        })

tabla_comunas = pd.DataFrame(metricas_por_comuna)

print("\nResultados por comuna — validación 2024:")
print(
    tabla_comunas
    .sort_values(["comuna_id", "modelo"])
    .round(3)
    .to_string(index=False)
)
