"use client"

import { ArrowUpRight, BookOpen, Database, Map, ShieldCheck } from "lucide-react"
import { DataNotice, PanelHeading } from "@/components/dashboard-shared"

const processSteps = [
  {
    title: "Comprensión del negocio",
    description: "Apoyar la revisión de comunas prioritarias según el volumen estimado y el cambio frente al histórico.",
  },
  {
    title: "Comprensión de los datos",
    description: "El histórico muestra diferencias entre comunas y huecos de cobertura: el análisis distingue territorio y fechas sin información.",
  },
  {
    title: "Preparación de los datos",
    description: "Conservar incidentes con comuna válida, incluso sin coordenadas. Los días sin cobertura quedan como faltantes, no como ceros.",
  },
  {
    title: "Modelado",
    description: "Regresión de conteos con boosting: comuna para diferencias territoriales, calendario para patrones temporales e historia reciente como referencia.",
  },
  {
    title: "Evaluación",
    description: "Entrenar jul 2022–ago 2024 y evaluar sep–dic 2024: MAE, RMSE y sesgo. Modelo fijo, predicción diaria de un paso.",
  },
  {
    title: "Despliegue",
    description: "Un mismo flujo prepara datos, calcula antecedentes, entrena y exporta resultados al tablero. El selector permite comparar modelos.",
  },
]

const limitations = [
  "Los 31 de diciembre de 2022, 2023 y 2024 tienen huecos en la fuente: no se interpretan como cero real. El 31 de diciembre de 2024 no se evalúa.",
  "Los registros sin comuna pueden reducir los conteos territoriales. La agregación oculta diferencias entre vías y horarios.",
  "La asociación histórica no demuestra causalidad ni permite inferir el riesgo de una persona.",
  "Septiembre–diciembre de 2024 ya fue explorado: no es una prueba independiente. Predicciones diarias, no siete días simultáneos. Sin intervalos evaluados.",
  "Se supone que los registros hasta ayer están disponibles al estimar el día siguiente; su retraso real de publicación no está verificado.",
]

const contributors = [
  "Alejandro Garcia Cortes",
  "Luis Alberto Ortiz Quiroga",
  "Esteban Salazar Orozco",
  "Juan Esteban Barrios Tovar",
]

export function MethodologyView() {
  return (
    <div className="view-stack">
      <DataNotice>
        Fuentes, variables y proceso de análisis para la seguridad vial en Medellín.
      </DataNotice>

      <section className="method-intro-grid" aria-label="Propósito y periodo de referencia">
        <article className="surface-card method-purpose-card">
          <div className="method-card-icon method-card-icon--green"><BookOpen size={19} aria-hidden="true" /></div>
          <div>
            <span className="eyebrow-label">PROPÓSITO</span>
            <h2>Orientar la revisión prioritaria de comunas.</h2>
            <p>
              Apoyo propuesto a la planeación de la Secretaría de Movilidad de Medellín: comparar las 16 comunas para revisar acciones de prevención y control. No asigna recursos automáticamente.
            </p>
          </div>
        </article>
        <article className="surface-card reference-period-card">
          <span className="eyebrow-label">VENTANA DE REFERENCIA</span>
          <strong>ene 2021 <i aria-hidden="true">→</i> ago 2025</strong>
          <p>Datos preparados: ene 2021–ago 2025. Entrenamiento: jul 2022–ago 2024. Validación mostrada: sep–dic 2024.</p>
          <span className="period-status"><span /> Periodo de análisis</span>
        </article>
      </section>

      <section className="surface-card sources-card" aria-labelledby="sources-title">
        <div className="surface-card-header">
          <PanelHeading
            title="Fuentes y variables"
            titleId="sources-title"
            description="Fuentes de información y variables para el análisis de seguridad vial."
          />
        </div>
        <div className="source-grid">
          <article className="source-item">
            <span className="source-icon"><Database size={17} aria-hidden="true" /></span>
            <div>
              <h3>Accidentes con víctimas</h3>
              <p>Secretaría de Movilidad de Medellín / Mendeley Data</p>
              <small>Estimamos el número de incidentes con heridos o fallecidos por comuna y día, no el número de personas. Horizonte actual: un día adelante.</small>
              <span className="source-tag">Fuente de referencia</span>
            </div>
          </article>
          <article className="source-item">
            <span className="source-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
            <div>
              <h3>Población por comuna</h3>
              <p>Proyecciones de Medellín / DANE</p>
              <small>Disponible como contexto; no se usa como predictor ni para tasas en esta versión del tablero.</small>
              <span className="source-tag">Fuente de referencia</span>
            </div>
          </article>
          <article className="source-item">
            <span className="source-icon"><Map size={17} aria-hidden="true" /></span>
            <div>
              <h3>Límites de comunas</h3>
              <p>GeoMedellín · capa de comunas urbanas</p>
              <small>Geometría pública simplificada para la visualización del mapa.</small>
              <a href="https://www.medellin.gov.co/geomedellin/" target="_blank" rel="noreferrer">
                Consultar GeoMedellín <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
          </article>
        </div>
      </section>

      <section className="surface-card process-card" aria-labelledby="process-title">
        <div className="surface-card-header">
          <PanelHeading
            title="Proceso de trabajo · CRISP-DM"
            titleId="process-title"
            description="Fases para documentar un flujo analítico reproducible."
          />
        </div>
        <ol className="process-grid">
          {processSteps.map((step, index) => (
            <li className="process-step" key={step.title}>
              <span className="process-step-number">0{index + 1}</span>
              <div className="process-step-connector" aria-hidden="true" />
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="method-bottom-grid" aria-label="Limitaciones y equipo">
        <article className="surface-card limitations-card">
          <div className="surface-card-header">
            <PanelHeading
              title="Alcance y limitaciones"
              description="Puntos que deben acompañar cualquier interpretación del pronóstico."
            />
          </div>
          <ul className="limitation-list">
            {limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </article>

        <article className="surface-card team-card">
          <div className="surface-card-header">
            <PanelHeading title="Equipo del proyecto" description="Seguridad vial · Medellín" />
          </div>
          <ul className="team-list">
            {contributors.map((name, index) => (
              <li key={name}>
                <span className="team-initials" aria-hidden="true">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                <span>{name}</span>
                <span className="team-role">Integrante {index + 1}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  )
}
