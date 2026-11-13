# Preparación de datos y análisis exploratorio

Esta entrega corresponde al integrante 1. Construye datos y evidencia descriptiva para el pronóstico de accidentes con víctimas. El modelo, sus variables de rezago, su ajuste y la API corresponden a las siguientes etapas. Las cifras de demostración del frontend no son resultados de este proceso.

## Ejecutar el proceso

Requiere Python 3.12. Desde la raíz del repositorio, en PowerShell:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-data.txt
```

Conservar `backend/datasets/Fatal_Road_Traffic.xlsx`. Copiar el Excel de población proporcionado por el equipo a `backend/data/raw/poblacion_barrios_veredas.xlsx`. Esta copia local está excluida de Git. No editar los originales. La redistribución de población queda pendiente de verificar sus condiciones de uso.

```powershell
cd backend
.venv/Scripts/python.exe -m data_pipeline.prepare
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

También se aceptan `--accidents RUTA` y `--population RUTA`. Las rutas relativas de entrada se resuelven desde `backend`; las salidas siempre se guardan en el repositorio. El Excel grande se recorre completo para auditar el histórico. La lectura puede tardar varios minutos. Las tablas pequeñas se escriben en CSV y Parquet; los incidentes individuales solo en Parquet local.

El notebook `backend/notebooks/01_calidad_y_eda.ipynb` guía la revisión de las salidas para estudio y sustentación. Elegir el entorno del proyecto en el editor de notebooks. Su visualización usa IPython, disponible en Jupyter; el pipeline y las pruebas no requieren Jupyter.

## Fuentes y trazabilidad

- Accidentes: Mendeley Data, DOI https://doi.org/10.17632/r6g5dfnpgh.1, versión 1, Cristian Correa. La ficha declara CC BY 4.0. Un registro representa un incidente, no una persona. Se conserva la fuente original atribuida a la Secretaría de Movilidad.
- Población: archivo `5.-Proyecciones-poblacionales-a-nivel-Barrios-y-Veredas-Medellin-2018-–-2030.xlsx`, hoja `Barrios - Veredas`. Fuente impresa: DANE, Dirección técnica de Censos y Demografía. El pie del archivo indica actualización el **28 de noviembre de 2025**. Catálogo de referencia: https://www.medellin.gov.co/es/centro-documental/proyecciones-poblacion-viviendas-y-hogares/.
- `docs/eda/auditoria.json` registra hashes SHA-256, nombres, tamaños, exclusiones, faltantes y conciliaciones para identificar exactamente los insumos. No contiene rutas personales.

La fecha de población difiere de la referencia de julio de 2025 descrita en la propuesta. Esta versión permite contextualización retrospectiva, pero no acredita qué información estaba disponible en 2021–2025. Por defecto, **no se autoriza su uso como predictor en un backtest operacional** sin resolver la disponibilidad histórica. La tabla se entrega separada del target para que el responsable de modelado controle ese uso.

## Reglas de preparación

1. Ventana inclusiva: 1 de enero de 2021 a 31 de agosto de 2025. Categorías objetivo: `HERIDO` y `MUERTO`. Se cuentan incidentes, sin sumar víctimas ni inferir la severidad de lesiones.
2. Comunas: códigos administrativos enteros 1–16. Los corregimientos 50, 60, 70, 80 y 90 se excluyen por alcance, no por mala calidad. `N/D` y códigos no asignables se reportan aparte. No se adivina la comuna a partir de direcciones.
3. Identidad: duplicados idénticos de `LLAVE` se cuentan una sola vez. Una llave con valores contradictorios detiene el proceso. Atributos iguales con llaves diferentes no se eliminan automáticamente porque podrían representar incidentes distintos.
4. Las coordenadas y horas faltantes no eliminan incidentes del conteo por comuna. Para mapas se requiere otra validación espacial. La caja geográfica del script es solo un control de plausibilidad, no una prueba de pertenencia a un polígono.
5. Población: solo hoja general, solo filas `Area Geográfica = Total`, solo comunas 1–16. Se comprueba que cada Total concilie con sus áreas. No se suman también `Cabecera Municipal` ni otras hojas de sexo/edad. Se conserva cada código territorial, incluso códigos de instituciones con población cero; no se deduplica por nombre de barrio.
6. La población debe ser positiva por comuna-año y la unión debe ser muchos-a-uno. Una ausencia o duplicación en las claves detiene el proceso.

## Calendario y cobertura

El panel diario incluye todas las combinaciones de las 16 comunas y el calendario de la ventana. Un cero significa **ningún accidente objetivo registrado en el archivo** para esa comuna y día. No demuestra ausencia real de accidentes ni completitud del registro administrativo.

Si no hay registros de ninguna gravedad en toda la ciudad un día, el target se marca nulo y el hueco se reporta, en vez de inventar un cero. La presencia de registros en la ciudad tampoco garantiza cobertura completa de cada comuna. Se requiere validación con el proveedor para certificar cobertura.

Las semanas son de lunes a domingo y los meses son calendario. Los paneles conservan bordes incompletos con `periodo_completo = false`; no se deben entrenar ni comparar como periodos completos. La primera semana comienza antes de la ventana y contiene solo 1–3 de enero de 2021. `conteo_observado_archivo` conserva la suma de eventos que sí aparecen, incluso en bloques con huecos. Su suma en las tres escalas debe conciliar con los incidentes. `accidentes_registrados`, el target propuesto, queda nulo en bloques con huecos detectados; no se usa el subtotal conocido como si fuera un total completo.

`apto_modelado_segun_cobertura` revisa únicamente bordes y huecos detectados. **No certifica ausencia de subregistro ni validez predictiva.** Una semana que cruza el límite entre conjuntos lleva `particion_sugerida = cruza_particion` y debe excluirse de esa separación.

## Contrato para los compañeros

| Salida local | Unidad y uso |
| --- | --- |
| `data/interim/incidentes_urbanos.parquet` | Incidente, para preparación y exploración local. No publicar puntos ni direcciones individuales. |
| `data/processed/poblacion_comuna_anio.*` | Una fila por comuna-año, 2021–2025, contexto retrospectivo. |
| `data/processed/serie_diaria.*` | Comuna-fecha, target `accidentes_registrados`, población contextual, evidencia de cobertura. |
| `data/processed/serie_semanal.*` | Comuna-semana lunes-domingo, conteo, fechas y banderas de cobertura. |
| `data/processed/serie_mensual.*` | Comuna-mes calendario, conteo, fechas y banderas de cobertura. |

En semanal/mensual, `poblacion_media_contexto` es el promedio de la población anual sobre los días incluidos, útil si una semana cruza de año. `tasa_contextual_100mil` es el conteo dividido por ese denominador y multiplicado por 100.000. No está anualizada, no mide flujo vial ni riesgo individual y no se compara directamente entre duraciones distintas.

Los modelos deben partir del conteo, no de gravedad, tasa ni población como predictores automáticos. Rezagos y medias móviles se calculan por comuna, desplazados al pasado. No mezclar aleatoriamente las fechas ni aprender transformaciones con el test. El frontend debe consumir agregados y conciliar sus totales entre vistas.

## Exploración y prevención de fuga temporal

Separación inicial propuesta, pendiente de acuerdo con integrante 2: entrenamiento 2021–2023, validación 2024 y prueba enero–agosto de 2025. No implica que ya exista entrenamiento o evaluación. La exploración de patrones y las gráficas publicadas utilizan solo 2021–2023. Los controles de calidad inspeccionan la cobertura completa y están separados del análisis para elegir predictores.

Las gráficas muestran conteos mensuales, conteos por comuna y promedio por día de semana y franja horaria. El promedio divide por los días de calendario de cada tipo, evitando confundir más viernes observados con mayor intensidad por viernes. Los horarios nulos se reportan y no se imputan. Franjas: 00–05, 06–11, 12–17 y 18–23, según la hora local del registro.

La ejecución detectó ausencia de registros de todas las gravedades el 31 de diciembre de 2022, 2023 y 2024. Se reportan como huecos de cobertura no resueltos, sin asegurar su causa y sin imputarlos. La gráfica mensual marca los meses afectados en el periodo de entrenamiento. `estadisticas_diarias_entrenamiento.csv` resume distribución de conteos conocidos por comuna y `clase_gravedad_entrenamiento.csv` desglosa tipos de incidente. No incluyen patrones de validación ni prueba.

Los años completos y 2025 parcial no se comparan directamente como cambio anual. `cobertura_anual_gravedad.csv` sirve para detectar cambios de registro por gravedad; una disminución en registros de daños no prueba una reducción de accidentes con víctimas. No atribuir causalidad a los patrones.

## Relación con las materias

| Material recibido | Aplicación en esta entrega | Argumento para sustentación |
| --- | --- | --- |
| Arquitecturas modernas de datos, `presentacion (2).pdf`, temas de metadatos, ciclo de vida y Medallion | Fuentes inmutables, auditoría, preparación y tablas agregadas separadas | Explicar cómo un registro llega al conteo y qué se excluyó. |
| Batch con Spark, `presentacion - Copy.pdf`, formatos y procesamiento ETL | Ingesta batch, tablas tipadas y Parquet/CSV | Parquet conserva tipos y permite lectura por columnas. Esta etapa usa pandas por tamaño y recursos; no simula procesamiento distribuido. |
| Evaluación moderna, `01_ml_modern_evaluation_imbalance_ensembles (1).pdf`, workflow y fuga | Separación temporal explícita y EDA antes del periodo reservado | Explicar por qué no podemos elegir variables mirando el error del test. |
| Predicción temporal, `03_ml_temporal_prediction (1).pdf`, baselines y orden temporal | Calendarios diarios/semanales/mensuales, bordes y particiones | Una semana parcial o una media calculada con futuro altera la evaluación. |
| Propuesta final del grupo, CRISP-DM | Comprensión, verificación de calidad y preparación documentadas | Esta etapa entrega el insumo de modelado y registra límites. |

La infraestructura AWS/Glue, orquestación y API no están implementadas aquí. El integrante 3 puede reutilizar estas reglas al llevar el proceso a su arquitectura del curso. No se aumentan datos sintéticos para entrenar el pronóstico real. La web de Visualización no pudo consultarse en la revisión previa; no se atribuyen a esa materia requisitos específicos aún no verificados. Las gráficas actuales aplican principios generales de legibilidad y comunicación descriptiva.

## Preguntas para estudiar

- ¿Por qué contamos incidentes y no heridos? Porque la unidad del archivo es el incidente y la categoría de gravedad no es un conteo de personas.
- ¿Por qué conservar un incidente sin coordenadas? Porque una comuna válida basta para nuestro target agregado, aunque no para ubicarlo en un mapa de puntos.
- ¿Por qué no sumar todas las hojas de población? Son representaciones y desagregaciones de la misma población; sumarlas duplicaría el denominador.
- ¿Un cero garantiza que no hubo accidentes? No, significa que no se registraron eventos objetivo en ese archivo.
- ¿La tasa poblacional es riesgo de circulación? No; la población residente no mide vehículos, peatones ni desplazamientos.
- ¿Por qué la población de esta versión no entra automáticamente al modelo? Su fecha de actualización es posterior al histórico evaluado.

Quedan por acordar horizontes de pronóstico, cortes definitivos, verificación territorial y estrategia de validación progresiva. El responsable de modelos debe registrar cualquier cambio antes de comparar candidatos.
