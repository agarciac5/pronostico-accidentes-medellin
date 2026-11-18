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
