# Ejecutar el Data Mart y el primer modelo

Esta guía corresponde al código principal, no a los experimentos locales.
Requiere Python 3.12 y Java 17, con `JAVA_HOME` apuntando al JDK y su
carpeta `bin` en `PATH`. Verificar `python --version` y `java -version`.

Desde la raíz del repositorio, en PowerShell:

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements-data.txt
```

Si ya existe un entorno del proyecto, activarlo en vez de crear otro.
Las cuatro dependencias de modelado añadidas están fijadas a las versiones
instaladas en el equipo de desarrollo. Se conservan las versiones anteriores
de preparación; esto no equivale a una instalación limpia verificada completa.

## Caché de Spark

Spark guarda sus dependencias Java en `pi-datos/ivy` dentro del directorio
temporal del sistema. No requiere una unidad D:. Para elegir otra ubicación
con espacio disponible, antes de ejecutar los scripts:

```powershell
$env:SPARK_IVY_DIR = Join-Path $env:LOCALAPPDATA "pi-datos\ivy"
```

Es opcional. La primera ejecución puede descargar dependencias de Delta
desde Maven y requiere acceso a Internet. En Windows, la escritura con
Hadoop puede requerir configuración adicional de bibliotecas nativas;
las instalaciones locales de Java/Hadoop no se incluyen en el repositorio.

## Orden de ejecución

1. Disponer de los Excel indicados en [DATOS.md](DATOS.md). Si falta
   `backend/data/interim/incidentes_urbanos.parquet`, ejecutar la preparación:

```powershell
python backend/data_pipeline/prepare.py
```

La preparación regenera datos y reportes: no ejecutarla sobre cambios del
equipo sin revisarlos primero. No modifica los Excel originales.

2. Construir e inspeccionar el Data Mart corregido:

```powershell
python backend/modelado/schema_load_star.py
python backend/modelado/validar_datamart.py
```

La carga escribe tablas Delta en `backend/data/datamart/datamart_delta_urbanos`.
Conserva la versión anterior del Data Mart. El MERGE inserta claves nuevas,
pero no propaga correcciones sobre claves existentes; no borrar tablas para
resolver diferencias sin revisarlas. El segundo script inspecciona las tablas,
no sustituye los controles de integridad de la carga.

3. Preparar la tabla y entrenar:

```powershell
python backend/data_pipeline/prepare_gradient.py
python backend/machinelearning/train_gradient.py
```

La preparación escribe `backend/data/processed/tabla_gradient_diaria`.
El entrenamiento imprime resultados y compara GradientBoostingRegressor con
100 árboles, profundidad 3 y tasa 0,1 frente a HistGradient sin ponderación
y ponderado a 180 días (principal del tablero). No guarda modelos entrenados; la exportación
descrita en `DASHBOARD_revision.md` reutiliza estos resultados para el tablero.
Entrena julio de 2022–agosto de 2024 y evalúa septiembre–diciembre
de 2024. Son predicciones diarias con historia observada hasta el día anterior,
no siete días simultáneos. Ese periodo ya fue explorado: no es prueba ciega.

Los faltantes históricos se conservan y las filas sin variables completas
se excluyen del entrenamiento/evaluación; se informa su cantidad.

## Archivos locales y Git

El Data Mart corregido, la tabla de entrenamiento, `ProcesosIA`, `apoyo`,
`data` de la raíz, `AGENTS.md` y `Glosario.md` están excluidos por `.gitignore`.
Cada integrante regenera las salidas locales. Estas reglas no retiran del
repositorio fuentes o salidas que ya estaban versionadas.
