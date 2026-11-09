# Pronóstico de Accidentes de Medellín

Proyecto para el análisis y pronóstico de accidentes de tránsito en Medellín.

## Estructura

```text
pronostico-accidentes-medellin/
├── backend/   # API y lógica del proyecto
├── frontend/  # Aplicación web
└── README.md
```

## Frontend

El frontend está desarrollado con Next.js, React, TypeScript y pnpm.

### Instalación

```bash
cd frontend
pnpm install
```

### Ejecutar en desarrollo

```bash
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Otros comandos

```bash
pnpm build  # Crear la versión de producción
pnpm start  # Ejecutar la versión de producción
```

## Backend

### Preparación y exploración de datos

La etapa del integrante 1 está en `backend/data_pipeline/prepare.py`. Genera auditoría de calidad, población por comuna y año, series diarias/semanales/mensuales y gráficas descriptivas. Las instrucciones, reglas y relación con las materias están en [docs/DATOS.md](docs/DATOS.md).

El proceso todavía no entrena modelos ni conecta el tablero. Las cifras actuales del frontend siguen siendo de demostración.

El backend se encuentra en `backend/`. La preparación de datos está implementada; la API, los modelos predictivos y los servicios de consulta conservan su estructura inicial.

Cuando esté implementado, sus instrucciones de instalación y ejecución se documentarán en esta sección.

