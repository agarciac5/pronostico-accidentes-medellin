# Dashboard con datos del proyecto

Desde la raíz y con el entorno Python del proyecto activo:

```powershell
python backend/data_pipeline/export_dashboard.py
cd frontend
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1
```

Abrir http://127.0.0.1:3000. La exportación reutiliza `train_gradient.py` y genera `frontend/lib/dashboard-data.json` con resultados agregados; repetirla cuando cambien los datos o el modelo. Requiere la tabla Gradient preparada y `incidentes_urbanos.parquet`.

La interfaz conserva el diseño existente. Muestra validación retrospectiva diaria de septiembre a diciembre de 2024, con historia observada hasta el día anterior, y patrones históricos de enero de 2021 a agosto de 2025. No son pronósticos actuales ni siete días calculados desde un mismo corte. No se estimaron intervalos, pronósticos semanales ni mensuales. El 31 de diciembre de 2024 no entra en la evaluación por falta de cobertura.

No utiliza ProcesosIA. Las métricas generales corresponden a las 16 comunas y a toda la validación; las métricas por comuna también corresponden al periodo completo. El cambio mostrado compara la estimación diaria con el conteo observado siete días antes.

En Modelos, el selector permite alternar Gradient Boosting, HistGradient sin ponderación y HistGradient ponderado con semivida de 180 días. Cambia las estimaciones y errores del tablero completo sin reentrenar en la interfaz. La selección se mantiene al navegar y vuelve al principal al recargar.

El principal es HistGradient ponderado a 180 días, por indicación del usuario de iniciar con el mejor de la comparación visible: tiene el menor MAE (1,515) y RMSE (1,996) en septiembre–diciembre de 2024. Esto no demuestra superioridad futura: en la evaluación posterior del 8 de enero al 28 de febrero de 2025, HistGradient sin ponderación obtuvo menor RMSE. No se mezclan las métricas de ambos periodos.

Las tres configuraciones se entrenan en `train_gradient.py` con las mismas filas y variables. HistGradient usa 200 iteraciones, tasa 0,05, siete hojas máximas, mínimo 20 observaciones por hoja, L2=1, sin parada temprana y semilla 42. La variante ponderada normaliza a media uno los pesos `2 ** (-edad_dias / 180)` calculados al corte del entrenamiento. No se incorporaron variables ni dependencias nuevas.

El resumen muestra un ejemplo de priorización: cada día se seleccionan las tres comunas con mayor predicción de cada modelo y, por separado, las tres con mayor promedio observado de los siete días anteriores. Los empates se resuelven por código de comuna ascendente. `backend/data_pipeline/priorizacion.py` suma los accidentes observados en las selecciones diarias y divide por el total observado en las 16 comunas durante las mismas fechas de validación; no promedia porcentajes diarios. La exportación existente guarda estos resultados en `priorizacion`. La frase cambia con el modelo, pero siempre corresponde al periodo completo, independientemente del filtro de fecha o comuna. Tres comunas es una regla ilustrativa, no una capacidad operativa confirmada; la concentración observada no demuestra accidentes evitados ni ahorro. Se reproduce con el comando de exportación indicado arriba.
