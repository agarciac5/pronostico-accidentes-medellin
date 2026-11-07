"use client"

import { Activity, Clock3, Info } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { DataNotice, PanelHeading } from "@/components/dashboard-shared"
import {
  monthlySeasonality,
  timeHeatmap,
  timeSlots,
  yearlyTrend,
} from "@/lib/mobility-data"

const monthlyConfig = {
  accidents: { label: "Accidentes", color: "#008060" },
} satisfies ChartConfig

const yearlyConfig = {
  accidents: { label: "Accidentes registrados", color: "#557e9b" },
} satisfies ChartConfig

const heatColors = ["#edf3ef", "#d7e6dc", "#b9d3c1", "#8cb79c", "#5e9878", "#337452"]

export function PatternsView({ periodLabel }: { periodLabel: string }) {
  return (
    <div className="view-stack">
      <DataNotice>
        Explora la distribución temporal de los accidentes para el periodo seleccionado: {periodLabel}.
      </DataNotice>

      <section className="heatmap-layout" aria-label="Distribución por día y franja horaria">
        <article className="surface-card heatmap-card">
          <div className="surface-card-header">
            <PanelHeading
              title="¿Cuándo se concentran los accidentes?"
              description="Frecuencia por día de la semana y franja horaria"
              action={<span className="quiet-count">Día × hora</span>}
            />
          </div>
          <div className="surface-card-content heatmap-content">
            <div className="heatmap-scroll">
              <table className="heatmap-table">
                <caption className="sr-only">Matriz de intensidad por día de la semana y franja horaria</caption>
                <thead>
                  <tr>
                    <th scope="col">Día</th>
                    {timeSlots.map((slot) => <th scope="col" key={slot}>{slot}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {timeHeatmap.map((row) => (
                    <tr key={row.day}>
                      <th scope="row">{row.day}</th>
                      {row.values.map((value, index) => {
                        const colorIndex = Math.min(heatColors.length - 1, Math.floor(value / 5))
                        return (
                          <td key={`${row.day}-${timeSlots[index]}`}>
                            <span
                              className={`heat-cell ${colorIndex >= 4 ? "heat-cell--light-text" : ""}`}
                              style={{ backgroundColor: heatColors[colorIndex] }}
                              aria-label={`${value} accidentes`}
                              title={`${row.day}, ${timeSlots[index].toLowerCase()}: ${value} casos`}
                            >
                              {value}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="heatmap-legend" aria-label="Escala de intensidad">
              <span>Menor frecuencia</span>
              {heatColors.map((color, index) => <i key={color} style={{ backgroundColor: color }} aria-hidden="true" />)}
              <span>Mayor frecuencia</span>
            </div>
          </div>
        </article>

        <aside className="pattern-insight-card">
          <div className="pattern-insight-icon"><Activity size={19} aria-hidden="true" /></div>
          <span className="pattern-insight-overline">LECTURA DEL PATRÓN</span>
          <h2>Viernes por la noche</h2>
          <p>Es la franja con mayor intensidad en el periodo seleccionado.</p>
          <div className="pattern-insight-value">
            <strong>24</strong>
            <span>accidentes</span>
          </div>
          <div className="pattern-insight-divider" />
          <div className="pattern-insight-secondary">
            <Clock3 size={15} aria-hidden="true" />
            <span>La tarde del sábado también presenta una concentración elevada.</span>
          </div>
          <div className="pattern-insight-footnote">
            <Info size={14} aria-hidden="true" />
            <span>La asociación temporal no demuestra causalidad.</span>
          </div>
        </aside>
      </section>

      <section className="pattern-chart-grid" aria-label="Tendencias históricas de referencia">
        <article className="surface-card">
          <div className="surface-card-header">
            <PanelHeading
              title="Accidentes por mes"
              description="Promedio mensual de enero a diciembre"
              action={<span className="quiet-count">Estacionalidad</span>}
            />
          </div>
          <div className="surface-card-content">
            <div className="chart-accessible-wrap" role="img" aria-label="Gráfico de barras de accidentes por mes">
              <ChartContainer config={monthlyConfig} className="chart-host chart-host--pattern">
                <BarChart data={monthlySeasonality} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e8ece9" strokeDasharray="4 4" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={8} width={42} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="accidents" fill="var(--color-accidents)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="surface-card-header">
            <PanelHeading
              title="Tendencia anual"
              description="Serie de referencia 2021–2025"
              action={<span className="quiet-count">2025 parcial</span>}
            />
          </div>
          <div className="surface-card-content">
            <div className="chart-accessible-wrap" role="img" aria-label="Gráfico de línea con tendencia anual de 2021 a 2025">
              <ChartContainer config={yearlyConfig} className="chart-host chart-host--pattern">
                <LineChart data={yearlyTrend} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e8ece9" strokeDasharray="4 4" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} tickMargin={8} width={48} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="accidents"
                    name="Accidentes registrados"
                    stroke="var(--color-accidents)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "var(--color-accidents)", stroke: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            </div>
            <p className="chart-footnote">2025 contempla enero–agosto en la serie original de referencia.</p>
          </div>
        </article>
      </section>
    </div>
  )
}
