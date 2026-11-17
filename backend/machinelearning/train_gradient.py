from pathlib import Path
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import GradientBoostingRegressor

BACKEND = Path(__file__).resolve().parents[1]
RUTA_DATOS = BACKEND / "data" / "processed" / "tabla_gradient_diaria"

# Leer la tabla pequeña que preparamos con Spark.
datos = pd.read_parquet(RUTA_DATOS)
datos["fecha"] = pd.to_datetime(datos["fecha"])
datos = datos.sort_values(["fecha", "comuna_id"])

variables = [
    "comuna_id", "dia_semana", "mes",
    "accidentes_ayer", "accidentes_hace_7_dias", "promedio_7_dias",
]

# Separar por fechas, sin mezclar aleatoriamente.
entrenamiento = datos.loc[
    datos["fecha"].between("2022-07-01", "2023-12-31")
].copy()

validacion = datos.loc[
    datos["fecha"].between("2024-01-01", "2024-12-31")
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

print(resultados.head(10))
print("Predicciones negativas:", (resultados["prediccion"] < 0).sum())

# Comparar el modelo con la referencia semanal.
metricas = []

for nombre, columna in [
    ("Gradient boosting", "prediccion"),
    ("Referencia semanal", "referencia_semanal"),
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