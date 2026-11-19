"use client"

import { ArrowUpRight, BookOpen, Database, Map, ShieldCheck } from "lucide-react"
import { DataNotice, PanelHeading } from "@/components/dashboard-shared"

const processSteps = [
  {
    title: "Comprensión del negocio",
    description: "Delimitar la pregunta: anticipar concentraciones para apoyar la planeación de seguridad vial.",
  },
  {
    title: "Comprensión de los datos",
    description: "Revisar cobertura temporal, campos, faltantes y definición de accidente con víctimas.",
  },
  {
    title: "Preparación de los datos",
    description: "Depurar registros, homologar comunas y agregar por día, semana y mes.",
  },
  {
    title: "Modelado",
    description: "Gradient Boosting con comuna, calendario, festivos, rezagos y promedio de siete días; referencias del mismo día anterior semana y promedio reciente.",
  },
  {
    title: "Evaluación",
    description: "Entrenar jul 2022–ago 2024 y evaluar sep–dic 2024: MAE, RMSE y sesgo. Modelo fijo, predicción diaria de un paso.",
  },
  {
    title: "Despliegue",
    description: "Consultar localmente resultados agregados exportados del modelo principal. Sin intervalos de incertidumbre ni pronósticos actuales.",
  },
]

const limitations = [
  "Los 31 de diciembre de 2022, 2023 y 2024 tienen huecos en la fuente: no se interpretan como cero real. El 31 de diciembre de 2024 no se evalúa.",
  "La agregación por comuna puede ocultar diferencias entre vías, horarios y tipos de usuario vial.",
  "La asociación histórica no demuestra causalidad ni permite inferir el riesgo de una persona.",
  "Septiembre–diciembre de 2024 ya fue explorado: no es una prueba independiente. Predicciones diarias, no siete días simultáneos. Sin intervalos evaluados.",
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
            <h2>Pronosticar para orientar, no para señalar.</h2>
            <p>
              El análisis busca resumir tendencias agregadas de accidentes con víctimas y apoyar la conversación sobre prevención vial en Medellín. Los resultados no se usan para evaluar personas ni predecir eventos individuales.
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
              <small>Variables de resultado: registros con persona herida o fallecida; agregación por comuna y periodo.</small>
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
