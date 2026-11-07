"use client"

import {
  ArrowDownRight,
  ArrowUpRight,
  CarFront,
  ChartNoAxesCombined,
  Clock3,
  MapPinned,
} from "lucide-react"
import {
  Area,
  CartesianGrid,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  DataNotice,
  formatCount,
  formatDecimal,
  MetricCard,
  PanelHeading,
  RiskBadge,
} from "@/components/dashboard-shared"
import {
  getChangePercent,
  getTrendSeries,
  type CommuneMetric,
  type Scale,
  type TrendPoint,
} from "@/lib/mobility-data"

const trendConfig = {
  observed: { label: "Observado", color: "#68727a" },
  forecast: { label: "Pronosticado", color: "#46515a" },
  intervalRange: { label: "Intervalo de confianza", color: "#dce2e7" },
} satisfies ChartConfig

type SummaryViewProps = {
  rows: CommuneMetric[]
  scale: Scale
  periodIndex: number
  periodLabel: string
  selectedCommuneId?: number
  selectedCommuneName: string
}

export function SummaryView({
  rows,
  scale,
  periodIndex,
  periodLabel,
  selectedCommuneId,
  selectedCommuneName,
}: SummaryViewProps) {
  const totalForecast = rows.reduce((total, row) => total + row.forecast, 0)
  const topCommune = [...rows].sort((first, second) => second.forecast - first.forecast)[0]
  const averageMae = rows.length
    ? rows.reduce((total, row) => total + row.mae, 0) / rows.length
    : 0
  const changePercent = getChangePercent(rows, periodIndex)
  const trendData = getTrendSeries(scale, periodIndex, selectedCommuneId)
  const maximumForecast = Math.max(...rows.map((row) => row.forecast), 1)
  const valueFormatter = selectedCommuneId ? formatDecimal : formatCount
  const scopeLabel = selectedCommuneId ? selectedCommuneName : "Medellín"

  return (
    <div className="view-stack">
      <DataNotice>
        Explora el pronóstico agregado por comuna y periodo para identificar concentraciones de riesgo.
      </DataNotice>

      <section className="metric-grid" aria-label="Indicadores principales">
        <MetricCard
          title="Accidentes pronosticados"
          value={formatCount(totalForecast)}
          detail={`${periodLabel} · ${selectedCommuneId ? selectedCommuneName : "todas las comunas"}`}
          icon={CarFront}
          tone="blue"
        />
        <MetricCard
          title="Mayor concentración"
          value={topCommune?.name ?? "Sin datos"}
          detail={topCommune ? `${formatCount(topCommune.forecast)} ${topCommune.forecast === 1 ? "accidente estimado" : "accidentes estimados"}` : "Sin comunas para mostrar"}
          icon={MapPinned}
          tone="teal"
          valueClassName="metric-value--name"
        />
        <article className="metric-card">
          <div className={`metric-icon ${changePercent >= 0 ? "metric-icon--red" : "metric-icon--teal"}`} aria-hidden="true">
            {changePercent >= 0 ? <ArrowUpRight size={20} strokeWidth={2.4} /> : <ArrowDownRight size={20} strokeWidth={2.4} />}
          </div>
          <p className="metric-title">Cambio vs. periodo anterior</p>
          <p className={`metric-value ${changePercent >= 0 ? "metric-value--red" : "metric-value--green"}`}>
            {changePercent > 0 ? "+" : ""}{formatDecimal(changePercent)}%
          </p>
          <p className="metric-detail">Accidentes con víctimas · {periodLabel}</p>
        </article>
        <MetricCard
          title="MAE promedio por comuna"
          value={formatDecimal(averageMae)}
          detail={`${scale} · menor valor indica menor error`}
          icon={ChartNoAxesCombined}
          tone="violet"
        />
      </section>

      <section className="overview-grid" aria-label="Pronóstico y comunas principales">
        <article className="surface-card chart-card">
          <div className="surface-card-header chart-card-header">
            <PanelHeading
              title="Tendencia de accidentes con víctimas"
              description={`Histórico reciente y pronóstico ${scale} para ${scopeLabel}`}
              action={<span className="confidence-tag"><span aria-hidden="true" /> IC 80%</span>}
            />
            <div className="chart-legend" aria-label="Leyenda de la gráfica">
              <span><i className="legend-line legend-line--observed" /> Observado</span>
              <span><i className="legend-line legend-line--forecast" /> Pronosticado</span>
              <span><i className="legend-band" /> Intervalo 80%</span>
            </div>
          </div>
          <div className="surface-card-content chart-card-content">
            <ChartContainer config={trendConfig} className="chart-host chart-host--summary">
              <ComposedChart data={trendData} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#e8ece9" strokeDasharray="4 4" />
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                  interval={scale === "diaria" ? 1 : "preserveStartEnd"}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  allowDecimals={Boolean(selectedCommuneId)}
                  width={42}
                />
                <ChartTooltip content={<TrendTooltip valueFormatter={valueFormatter} />} />
                <Area
                  type="monotone"
                  dataKey="lowerBase"
                  stackId="interval"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="intervalRange"
                  stackId="interval"
                  stroke="none"
                  fill="var(--color-intervalRange)"
                  fillOpacity={0.88}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="observed"
                  name="Observado"
                  stroke="var(--color-observed)"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-observed)", stroke: "#fff", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Pronosticado"
                  stroke="var(--color-forecast)"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-forecast)", stroke: "#fff", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ChartContainer>
            <div className="chart-footnote">
              <Clock3 size={14} aria-hidden="true" />
              <span>El sombreado representa el intervalo estimado; no es una garantía de resultado.</span>
            </div>
          </div>
        </article>

        <article className="surface-card ranking-card">
          <div className="surface-card-header">
            <PanelHeading
              title="Comunas con mayor pronóstico"
              description={`${periodLabel} · ${rows.length} ${rows.length === 1 ? "comuna" : "comunas"} en el filtro`}
              action={<span className="quiet-count">Top 5</span>}
            />
          </div>
          <div className="surface-card-content ranking-list">
            {rows.length ? (
              [...rows]
                .sort((first, second) => second.forecast - first.forecast)
                .slice(0, 5)
                .map((row, index) => (
                  <div className="ranking-row" key={row.id}>
                    <span className="ranking-position">{String(index + 1).padStart(2, "0")}</span>
                    <div className="ranking-main">
                      <div className="ranking-labels">
                        <strong>{row.name}</strong>
                        <span>{formatCount(row.forecast)}</span>
                      </div>
                      <div
                        className="ranking-meter"
                        role="progressbar"
                        aria-label={`Pronóstico relativo para ${row.name}`}
                        aria-valuemin={0}
                        aria-valuemax={maximumForecast}
                        aria-valuenow={row.forecast}
                      >
                        <span style={{ width: `${Math.max(8, (row.forecast / maximumForecast) * 100)}%` }} />
                      </div>
                    </div>
                    <RiskBadge level={row.risk} />
                  </div>
                ))
            ) : (
              <p className="empty-inline">No hay comunas para mostrar con este filtro.</p>
            )}
          </div>
          <div className="ranking-footer">
            <span>Estimación de accidentes con víctimas</span>
            <span className="ranking-footer-dot" aria-hidden="true" />
            <span>Estimación agregada</span>
          </div>
        </article>
      </section>

      <div className="summary-insight" role="note">
        <span className="summary-insight-icon" aria-hidden="true"><Clock3 size={17} /></span>
        <p>
          <strong>Lectura del pronóstico.</strong> El modelo tiende a asignar mayor probabilidad en comunas con más siniestros históricos. La estimación no implica causalidad ni reemplaza la evaluación de seguridad vial.
        </p>
      </div>
    </div>
  )
}

function TrendTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean
  payload?: Array<{ payload?: TrendPoint }>
  label?: string
  valueFormatter: (value: number) => string
}) {
  if (!active || !payload?.length) return null

  const point = payload.find((item) => item.payload)?.payload
  if (!point) return null

  const intervalUpper =
    point.lowerBase != null && point.intervalRange != null
      ? point.lowerBase + point.intervalRange
      : null

  return (
    <div className="chart-tooltip">
      <strong>{label ?? point.period}</strong>
      {!point.forecastPeriod && point.observed != null ? (
        <span><i className="tooltip-dot tooltip-dot--observed" /> Observado <b>{valueFormatter(point.observed)}</b></span>
      ) : null}
      {point.forecastPeriod && point.forecast != null ? (
        <span><i className="tooltip-dot tooltip-dot--forecast" /> Pronosticado <b>{valueFormatter(point.forecast)}</b></span>
      ) : null}
      {point.forecastPeriod && point.lowerBase != null && intervalUpper != null ? (
        <small>Intervalo 80%: {valueFormatter(point.lowerBase)}–{valueFormatter(intervalUpper)}</small>
      ) : null}
    </div>
  )
}
