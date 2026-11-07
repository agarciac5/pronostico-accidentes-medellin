"use client"

import { Check, Info, ShieldCheck } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  DataNotice,
  formatDecimal,
  PanelHeading,
} from "@/components/dashboard-shared"
import {
  modelScores,
  type CommuneMetric,
  type Scale,
} from "@/lib/mobility-data"

const errorConfig = {
  mae: { label: "MAE por comuna", color: "#557e9b" },
} satisfies ChartConfig

const scaleLabels: Record<Scale, string> = {
  diaria: "Diaria",
  semanal: "Semanal",
  mensual: "Mensual",
}

type ModelViewProps = {
  rows: CommuneMetric[]
  scale: Scale
  selectedCommuneName: string
}

export function ModelView({ rows, scale, selectedCommuneName }: ModelViewProps) {
  const scoresForScale = modelScores.map((model) => model.scores[scale])
  const bestMae = Math.min(...scoresForScale.map((score) => score.mae))
  const bestRmse = Math.min(...scoresForScale.map((score) => score.rmse))
  const bestModel = modelScores.find((model) => model.scores[scale].mae === bestMae)
  const errorRows = [...rows].sort((first, second) => first.mae - second.mae)
  const errorChartData = errorRows.map((row) => ({
    name: row.name,
    mae: row.mae,
  }))

  return (
    <div className="view-stack">
      <DataNotice>
        Compara las métricas de error por modelo, comuna y escala temporal.
      </DataNotice>

      <section className="model-summary-row" aria-label="Resumen de validación">
        <article className="model-summary-card">
          <span className="model-summary-icon model-summary-icon--teal"><ShieldCheck size={20} strokeWidth={2.4} aria-hidden="true" /></span>
          <div>
            <span>Esquema de validación</span>
            <strong>Walk-forward</strong>
            <small>Partición cronológica · sin mezclar futuro con pasado</small>
          </div>
        </article>
        <article className="model-summary-card">
          <span className="model-summary-icon model-summary-icon--blue"><Check size={20} strokeWidth={2.4} aria-hidden="true" /></span>
          <div>
            <span>Menor MAE · {scaleLabels[scale].toLowerCase()}</span>
            <strong>{formatDecimal(bestMae)} <small>accidentes</small></strong>
            <small>{bestModel?.name ?? "Modelo"}</small>
          </div>
        </article>
        <article className="model-summary-card">
          <span className="model-summary-icon model-summary-icon--orange"><Info size={20} strokeWidth={2.4} aria-hidden="true" /></span>
          <div>
            <span>RMSE del mejor modelo</span>
            <strong>{formatDecimal(bestRmse)} <small>accidentes</small></strong>
            <small>La escala cambia la magnitud del error.</small>
          </div>
        </article>
      </section>

      <article className="surface-card model-table-card">
        <div className="surface-card-header">
          <PanelHeading
            title="Comparación de modelos"
            description="Error medio absoluto (MAE) y raíz del error cuadrático medio (RMSE)"
            action={<span className="quiet-count">Escala temporal</span>}
          />
        </div>
        <div className="model-table-scroll">
          <table className="data-table model-table">
            <caption className="sr-only">Comparación de MAE y RMSE por modelo y escala temporal</caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>Modelo</th>
                <th scope="colgroup" colSpan={2}>Diaria</th>
                <th scope="colgroup" colSpan={2}>Semanal</th>
                <th scope="colgroup" colSpan={2}>Mensual</th>
              </tr>
              <tr>
                {(["diaria", "semanal", "mensual"] as Scale[]).flatMap((modelScale) => [
                  <th scope="col" key={`${modelScale}-mae`}>MAE</th>,
                  <th scope="col" key={`${modelScale}-rmse`}>RMSE</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {modelScores.map((model) => (
                <tr key={model.name}>
                  <th scope="row" className="model-name-cell">
                    <strong>{model.name}</strong>
                    <small>{model.description}</small>
                  </th>
                  {(["diaria", "semanal", "mensual"] as Scale[]).flatMap((modelScale) => {
                    const score = model.scores[modelScale]
                    const bestScaleMae = Math.min(...modelScores.map((item) => item.scores[modelScale].mae))
                    const bestScaleRmse = Math.min(...modelScores.map((item) => item.scores[modelScale].rmse))

                    return [
                      <td className={score.mae === bestScaleMae ? "score-cell score-cell--best" : "score-cell"} key={`${model.name}-${modelScale}-mae`}>
                        {formatDecimal(score.mae)}
                      </td>,
                      <td className={score.rmse === bestScaleRmse ? "score-cell score-cell--best" : "score-cell"} key={`${model.name}-${modelScale}-rmse`}>
                        {formatDecimal(score.rmse)}
                      </td>,
                    ]
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footnote model-table-footnote">
          <span className="best-cell-key" aria-hidden="true" />
          <span>La celda resaltada marca el menor valor de error en cada escala.</span>
        </div>
      </article>

      <section className="model-detail-grid" aria-label="Error por comuna y validación">
        <article className="surface-card">
          <div className="surface-card-header">
            <PanelHeading
              title="Error por comuna"
              description={`MAE · ${scaleLabels[scale].toLowerCase()} · ${selectedCommuneName}`}
              action={<span className="quiet-count">MAE · {scaleLabels[scale]}</span>}
            />
          </div>
          <div className="surface-card-content">
            {errorChartData.length ? (
              <div className="chart-accessible-wrap" role="img" aria-label={`Gráfico del error medio absoluto por comuna, escala ${scaleLabels[scale]}`}>
                <ChartContainer config={errorConfig} className="chart-host chart-host--errors">
                  <BarChart
                    accessibilityLayer
                    data={errorChartData}
                    layout="vertical"
                    margin={{ top: 2, right: 10, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke="#e8ece9" strokeDasharray="4 4" />
                    <XAxis type="number" axisLine={false} tickLine={false} tickMargin={8} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={8}
                      width={116}
                      interval={0}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="mae" fill="var(--color-mae)" radius={[0, 4, 4, 0]} maxBarSize={17} />
                  </BarChart>
                </ChartContainer>
              </div>
            ) : (
              <p className="empty-inline">No hay comunas para comparar.</p>
            )}
          </div>
        </article>

        <article className="surface-card validation-card">
          <div className="surface-card-header">
            <PanelHeading
              title="Validación temporal"
              description="Esquema recomendado para evitar fuga de información"
            />
          </div>
          <div className="surface-card-content validation-content">
            <div className="validation-status">
              <span className="validation-status-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
              <div>
                <strong>Walk-forward temporal</strong>
                <span>La evaluación avanza periodo a periodo.</span>
              </div>
            </div>
            <ol className="validation-steps">
              <li><span>1</span><p>Entrenar con el historial disponible.</p></li>
              <li><span>2</span><p>Pronosticar el siguiente bloque temporal.</p></li>
              <li><span>3</span><p>Comparar contra el dato observado.</p></li>
              <li><span>4</span><p>Desplazar la ventana y repetir.</p></li>
            </ol>
            <div className="validation-note">
              <Info size={15} aria-hidden="true" />
              <p>La evaluación real debe reportar el periodo de prueba, cantidad de observaciones y dispersión del error.</p>
            </div>
          </div>
        </article>
      </section>

      <p className="table-footnote">
        MAE resume el error absoluto promedio; RMSE penaliza más los errores grandes. Las cifras cambian con la escala y no deben compararse sin contexto.
      </p>
    </div>
  )
}
