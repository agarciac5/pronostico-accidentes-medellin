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
  modelOptions,
  defaultModel,
  type ModelId,
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
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  rows: CommuneMetric[]
  scale: Scale
  selectedCommuneName: string
}

export function ModelView({ rows, scale, selectedCommuneName, selectedModel, onModelChange }: ModelViewProps) {
  const scoresForScale = modelScores.map((model) => model.scores.diaria)
  const bestMae = Math.min(...scoresForScale.map((score) => score.mae))
  const bestRmse = Math.min(...scoresForScale.map((score) => score.rmse))
  const bestModel = modelScores.find((model) => model.scores.diaria.mae === bestMae)
  const bestRmseModel = modelScores.find((model) => model.scores.diaria.rmse === bestRmse)
  const selectedName = modelOptions.find((model) => model.id === selectedModel)!.nombre
  const errorRows = [...rows].sort((first, second) => first.mae - second.mae)
  const errorChartData = errorRows.map((row) => ({
    name: row.name,
    mae: row.mae,
  }))

  return (
    <div className="view-stack">
      <DataNotice>
        Entrenamiento jul 2022–ago 2024; validación sep–dic 2024, 1.936 filas. Resultados para las 16 comunas.
      </DataNotice>

      <section className="model-summary-row" aria-label="Resumen de validación">
        <article className="model-summary-card">
          <span className="model-summary-icon model-summary-icon--teal"><ShieldCheck size={20} strokeWidth={2.4} aria-hidden="true" /></span>
          <div>
            <span>Esquema de validación</span>
            <strong>Bloque temporal fijo</strong>
            <small>Partición cronológica · sin mezclar futuro con pasado</small>
          </div>
        </article>
        <article className="model-summary-card">
          <span className="model-summary-icon model-summary-icon--blue"><Check size={20} strokeWidth={2.4} aria-hidden="true" /></span>
          <div>
            <span>Menor MAE · {scaleLabels[scale].toLowerCase()}</span>
            <strong>{formatDecimal(bestMae, 3)} <small>accidentes</small></strong>
            <small>{bestModel?.name ?? "Modelo"}</small>
          </div>
        </article>
        <article className="model-summary-card">
          <span className="model-summary-icon model-summary-icon--orange"><Info size={20} strokeWidth={2.4} aria-hidden="true" /></span>
          <div>
            <span>Menor RMSE · {scaleLabels[scale].toLowerCase()}</span>
            <strong>{formatDecimal(bestRmse, 3)} <small>accidentes</small></strong>
            <small>{bestRmseModel?.name}</small>
          </div>
        </article>
      </section>

      <article className="surface-card model-table-card">
        <div className="surface-card-header">
          <PanelHeading
            title="¿Qué modelo tiene menor error?"
            description="De menor a mayor RMSE; MAE como desempate. Menor error es mejor."
            action={
              <label className="header-select">
                <span>Modelo del tablero</span>
                <select aria-label="Modelo del tablero" value={selectedModel} onChange={(event) => onModelChange(event.target.value as ModelId)}>
                  {modelOptions.map((model) => <option key={model.id} value={model.id}>{model.nombre}{model.id === defaultModel ? " · Principal" : ""}</option>)}
                </select>
              </label>
            }
          />
        </div>
        <div className="model-table-scroll">
          <table className="data-table model-table">
            <caption className="sr-only">Comparación de MAE y RMSE por modelo y escala temporal</caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>Modelo</th>
                <th scope="colgroup" colSpan={2}>Diaria</th>
              </tr>
              <tr>
                {(["diaria"] as const).flatMap((modelScale) => [
                  <th scope="col" key={`${modelScale}-mae`}>MAE</th>,
                  <th scope="col" key={`${modelScale}-rmse`}>RMSE</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {modelScores.map((model) => (
                <tr key={model.name}>
                  <th scope="row" className="model-name-cell">
                    <strong>{model.name}{model.name === selectedName ? " · Activo" : ""}</strong>
                    <small>{model.description}</small>
                  </th>
                  {(["diaria"] as const).flatMap((modelScale) => {
                    const score = model.scores[modelScale]
                    const bestScaleMae = Math.min(...modelScores.map((item) => item.scores[modelScale].mae))
                    const bestScaleRmse = Math.min(...modelScores.map((item) => item.scores[modelScale].rmse))

                    return [
                      <td className={score.mae === bestScaleMae ? "score-cell score-cell--best" : "score-cell"} key={`${model.name}-${modelScale}-mae`}>
                        {formatDecimal(score.mae, 3)}
                      </td>,
                      <td className={score.rmse === bestScaleRmse ? "score-cell score-cell--best" : "score-cell"} key={`${model.name}-${modelScale}-rmse`}>
                        {formatDecimal(score.rmse, 3)}
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
          <span>Menor error resaltado. El selector actualiza estimaciones y errores en todo el tablero. Principal: HistGradient ponderado 180 días, con el menor MAE y RMSE en el periodo mostrado (septiembre–diciembre de 2024).</span>
        </div>
      </article>

      <section className="model-detail-grid" aria-label="Error por comuna y validación">
        <article className="surface-card">
          <div className="surface-card-header">
            <PanelHeading
              title="¿Cuánto se equivoca el modelo en cada comuna?"
              description={`MAE · ${selectedName} · ${selectedCommuneName}`}
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
              title="¿Cómo se evaluaron las estimaciones?"
              description="Esquema recomendado para evitar fuga de información"
            />
          </div>
          <div className="surface-card-content validation-content">
            <div className="validation-status">
              <span className="validation-status-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
              <div>
                <strong>Bloque temporal fijo</strong>
                <span>Modelo fijo; cada día utiliza la historia real hasta ayer.</span>
              </div>
            </div>
            <ol className="validation-steps">
              <li><span>1</span><p>Entrenar con el historial disponible.</p></li>
              <li><span>2</span><p>Pronosticar el siguiente bloque temporal.</p></li>
              <li><span>3</span><p>Comparar contra el dato observado.</p></li>
              <li><span>4</span><p>Evaluar 121 días por comuna; excluir el 31 de diciembre por faltante.</p></li>
            </ol>
            <div className="validation-note">
              <Info size={15} aria-hidden="true" />
              <p>Periodo ya explorado, no prueba independiente. Los modelos semanal y mensual aún no están implementados en el código principal.</p>
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
