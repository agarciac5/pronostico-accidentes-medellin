"""Exporta datos agregados del proyecto: python backend/data_pipeline/export_dashboard.py."""
from pathlib import Path
import json
import runpy

import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]

# Reutiliza el entrenamiento principal sin duplicar el modelo ni sus parámetros.
ejecucion = runpy.run_path(str(RAIZ / "backend/machinelearning/train_gradient.py"))
resultados = ejecucion["resultados"].copy()
datos = ejecucion["datos"]
assert not resultados.duplicated(["fecha", "comuna_id"]).any()
assert resultados.groupby("fecha").size().eq(16).all()
assert resultados.notna().all().all()

def registros(tabla):
    return json.loads(tabla.to_json(orient="records", date_format="iso"))

resultados["fecha"] = resultados.fecha.dt.strftime("%Y-%m-%d")
historico = datos.loc[
    datos.fecha.between("2024-08-18", "2024-12-30"),
    ["fecha", "comuna_id", "accidentes"],
].copy()
historico["fecha"] = historico.fecha.dt.strftime("%Y-%m-%d")

# Patrones descriptivos: fuente principal, sin usar resultados experimentales.
detalle = pd.read_parquet(RAIZ / "backend/data/interim/incidentes_urbanos.parquet")
detalle["fecha"] = pd.to_datetime(detalle.fecha)
assert detalle.comuna_id.between(1, 16).all()
assert detalle.gravedad.isin(["HERIDO", "MUERTO"]).all()
detalle["dia"] = detalle.fecha.dt.day_of_week
detalle["franja"] = detalle.hora // 6
calor = detalle.groupby(["dia", "franja"]).size().unstack(fill_value=0)
calor = calor.reindex(index=range(7), columns=range(4), fill_value=0)
meses = detalle.groupby(detalle.fecha.dt.to_period("M")).size()
promedio_mes = meses.groupby(meses.index.month).mean()
anios = detalle.groupby(detalle.fecha.dt.year).size()

salida = {
    "predicciones": registros(resultados),
    "historico": registros(historico),
    "metricas": ejecucion["metricas"],
    "comunas": registros(ejecucion["tabla_comunas"]),
    "calor": calor.values.tolist(),
    "meses": promedio_mes.reindex(range(1, 13)).tolist(),
    "anios": [{"year": str(anio) + ("*" if anio == 2025 else ""), "accidents": int(n)} for anio, n in anios.items()],
    "metadatos": {
        "modelo": "GradientBoostingRegressor",
        "entrenamiento": "2022-07-01 a 2024-08-31",
        "validacion": "2024-09-01 a 2024-12-30 (31 de diciembre excluido por faltante)",
        "horizonte": "Un día; historia observada hasta el día anterior",
        "historico_patrones": "2021-01-01 a 2025-08-31",
        "incidentes_patrones": len(detalle),
        "horas_faltantes": int(detalle.hora.isna().sum()),
        "filas_validacion": len(resultados),
        "fuentes": ["backend/data/processed/tabla_gradient_diaria", "backend/data/interim/incidentes_urbanos.parquet"],
    },
}
destino = RAIZ / "frontend/lib/dashboard-data.json"
destino.write_text(json.dumps(salida, ensure_ascii=False, allow_nan=False, separators=(",", ":")), encoding="utf-8")
print(f"Dashboard exportado: {len(resultados)} predicciones; {len(detalle)} incidentes para patrones.")
