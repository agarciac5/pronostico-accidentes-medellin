"""Comparación retrospectiva de tres comunas por día, sin entrenar modelos."""

def comparar_priorizacion(resultados, modelos):
    columnas = ["referencia_promedio"] + [modelo["id"] for modelo in modelos]
    assert not resultados.duplicated(["fecha", "comuna_id"]).any()
    assert resultados.groupby("fecha").comuna_id.apply(lambda ids: set(ids) == set(range(1, 17))).all()
    assert resultados[["accidentes", *columnas]].notna().all().all()
    total = float(resultados.accidentes.sum())
    comparacion = {}
    for columna in columnas:
        # Seleccionar antes de consultar lo observado; mismo desempate para todos.
        seleccion = resultados.sort_values(
            ["fecha", columna, "comuna_id"], ascending=[True, False, True]
        ).groupby("fecha", sort=False).head(3)
        captados = float(seleccion.accidentes.sum())
        comparacion[columna] = {
            "accidentes_observados": captados,
            "porcentaje": 100 * captados / total if total else None,
        }
    return {
        "comunas_por_dia": 3,
        "dias": int(resultados.fecha.nunique()),
        "inicio": str(resultados.fecha.min())[:10],
        "fin": str(resultados.fecha.max())[:10],
        "total_observado": total,
        "comparacion": comparacion,
    }
