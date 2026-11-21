import data from "./dashboard-data.json"

export type Scale = "diaria" | "semanal" | "mensual"
export type RiskLevel = "Bajo" | "Medio" | "Alto"
export type ModelId = "prediccion" | "prediccion_gradient" | "prediccion_ponderada"
export const defaultModel: ModelId = "prediccion_ponderada"
export const modelOptions = data.modelos as { id: ModelId; nombre: string }[]
export const metadata = data.metadatos
export const dates = [...new Set(data.predicciones.map((row) => row.fecha))].sort()
export const periodOptions: Record<Scale, string[]> = { diaria: dates, semanal: [], mensual: [] }
const names = ["Popular", "Santa Cruz", "Manrique", "Aranjuez", "Castilla", "Doce de Octubre", "Robledo", "Villa Hermosa", "Buenos Aires", "La Candelaria", "Laureles-Estadio", "La América", "San Javier", "El Poblado", "Guayabal", "Belén"]
export type CommuneMetric = {
  id: number; name: string; forecast: number; observed: number; mae: number;
  reference: number; risk: RiskLevel; trend: number[]
}

// Tercios del rango mostrado: intensidad visual, no riesgo individual.
export function getRiskLevel(value: number, values: number[]): RiskLevel {
  const max = Math.max(...values, 1)
  return value >= max * 2 / 3 ? "Alto" : value >= max / 3 ? "Medio" : "Bajo"
}
export function getCommuneRows(_scale: Scale, periodIndex = 0, model: ModelId = defaultModel): CommuneMetric[] {
  const fecha = dates[periodIndex] ?? dates[0]
  const rows = data.predicciones.filter((row) => row.fecha === fecha)
  return rows.map((row) => ({
    id: row.comuna_id, name: names[row.comuna_id - 1], forecast: row[model],
    observed: row.accidentes, reference: row.referencia_semanal,
    mae: data.comunas.find((metric) => metric.comuna_id === row.comuna_id && metric.modelo === modelOptions.find((item) => item.id === model)!.nombre)!.MAE,
    risk: getRiskLevel(row[model], rows.map((item) => item[model])),
    trend: data.historico.filter((item) => item.comuna_id === row.comuna_id && item.fecha < fecha).slice(-7).map((item) => item.accidentes),
  }))
}
export function getChangePercent(rows: CommuneMetric[], _periodIndex: number) {
  const previous = rows.reduce((sum, row) => sum + row.reference, 0)
  return previous === 0 ? null : (rows.reduce((sum, row) => sum + row.forecast, 0) / previous - 1) * 100
}
export type TrendPoint = {
  period: string; observed: number | null; forecast: number | null;
  lowerBase: null; intervalRange: null; forecastPeriod: boolean
}
export function getTrendSeries(_scale: Scale, periodIndex = 0, communeId?: number, model: ModelId = defaultModel): TrendPoint[] {
  const selected = dates[periodIndex] ?? dates[0]
  const history = data.historico.filter((row) => row.fecha <= selected && (!communeId || row.comuna_id === communeId))
  const days = [...new Set(history.map((row) => row.fecha))].sort().slice(-15)
  return days.map((day) => {
    const actual = history.filter((row) => row.fecha === day)
    const predicted = data.predicciones.filter((row) => row.fecha === day && (!communeId || row.comuna_id === communeId))
    return { period: day, observed: actual.reduce((sum, row) => sum + row.accidentes, 0),
      forecast: predicted.length ? predicted.reduce((sum, row) => sum + row[model], 0) : null,
      lowerBase: null, intervalRange: null, forecastPeriod: predicted.length > 0 }
  })
}
const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
export const monthlySeasonality = data.meses.map((accidents, i) => ({month: monthNames[i], accidents}))
export const yearlyTrend = data.anios
export const timeHeatmap = data.calor.map((values, i) => ({day: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i], values}))
export const timeSlots = ["00–05", "06–11", "12–17", "18–23"]
export const peak = timeHeatmap.flatMap((row) => row.values.map((value, i) => ({day: row.day, slot: timeSlots[i], value}))).sort((a,b) => b.value-a.value)[0]
export const modelScores = data.metricas.map((metric) => ({
  name: metric.modelo, description: "Validación diaria · septiembre–diciembre 2024",
  scores: { diaria: {mae: metric.MAE, rmse: metric.RMSE} }, bias: metric.sesgo,
}))
