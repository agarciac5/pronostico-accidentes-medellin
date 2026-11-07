export type Scale = "diaria" | "semanal" | "mensual"
export type RiskLevel = "Bajo" | "Medio" | "Alto"

export type CommuneMetric = {
  id: number
  name: string
  population: number
  forecast: number
  intervalLow: number
  intervalHigh: number
  observed: number
  mae: number
  rate: number
  risk: RiskLevel
  changePct: number
  monthlyEquivalent: number
  trend: number[]
}

const communeSeeds = [
  { id: 1, name: "Popular", population: 134_000, monthlyBase: 18, changePct: 4.2 },
  { id: 2, name: "Santa Cruz", population: 110_000, monthlyBase: 16, changePct: 3.6 },
  { id: 3, name: "Manrique", population: 157_000, monthlyBase: 26, changePct: 8.1 },
  { id: 4, name: "Aranjuez", population: 139_000, monthlyBase: 28, changePct: 10.5 },
  { id: 5, name: "Castilla", population: 151_000, monthlyBase: 20, changePct: 5.7 },
  { id: 6, name: "Doce de Octubre", population: 195_000, monthlyBase: 26, changePct: 7.4 },
  { id: 7, name: "Robledo", population: 180_000, monthlyBase: 31, changePct: 9.2 },
  { id: 8, name: "Villa Hermosa", population: 140_000, monthlyBase: 22, changePct: 6.1 },
  { id: 9, name: "Buenos Aires", population: 146_000, monthlyBase: 19, changePct: 2.8 },
  { id: 10, name: "La Candelaria", population: 91_000, monthlyBase: 36, changePct: 12.6 },
  { id: 11, name: "Laureles-Estadio", population: 123_000, monthlyBase: 24, changePct: 4.9 },
  { id: 12, name: "La América", population: 95_000, monthlyBase: 16, changePct: -1.8 },
  { id: 13, name: "San Javier", population: 138_000, monthlyBase: 21, changePct: 3.1 },
  { id: 14, name: "El Poblado", population: 142_000, monthlyBase: 22, changePct: 1.7 },
  { id: 15, name: "Guayabal", population: 94_000, monthlyBase: 19, changePct: 6.8 },
  { id: 16, name: "Belén", population: 200_000, monthlyBase: 30, changePct: 7.9 },
] as const

const scaleFactors: Record<Scale, number> = {
  diaria: 1 / 30,
  semanal: 7 / 30,
  mensual: 1,
}

const errorBase: Record<Scale, number> = {
  diaria: 0.8,
  semanal: 2.1,
  mensual: 7.2,
}

const periodAdjustments = [1, 1.035, 0.97]
const trendMultipliers = [0.76, 0.87, 0.81, 0.95, 1.02, 0.93, 1.12]

export function getScaleFactor(scale: Scale) {
  return scaleFactors[scale]
}

export function getRiskLevel(monthlyEquivalent: number): RiskLevel {
  if (monthlyEquivalent >= 27) return "Alto"
  if (monthlyEquivalent >= 20) return "Medio"
  return "Bajo"
}

export function getCommuneRows(scale: Scale, periodIndex = 0): CommuneMetric[] {
  const adjustment = periodAdjustments[periodIndex] ?? 1
  const factor = scaleFactors[scale]

  return communeSeeds.map((commune, index) => {
    const monthlyEquivalent = commune.monthlyBase * 1.04 * adjustment
    const forecast = Math.max(0, Math.round(monthlyEquivalent * factor))
    const observedAdjustment = 0.94 + ((index * 7) % 9) / 100
    const observed = Math.max(
      0,
      Math.round(commune.monthlyBase * factor * observedAdjustment)
    )
    const intervalMargin = Math.max(
      1,
      Math.round(forecast * (scale === "diaria" ? 0.55 : 0.14))
    )
    const mae = Math.round(errorBase[scale] * (0.78 + (index % 5) * 0.11) * 10) / 10
    const rate = Math.round((forecast / commune.population) * 100_000 * 10) / 10
    const trend = trendMultipliers.map((multiplier) =>
      Math.max(0, Math.round(forecast * multiplier))
    )

    return {
      id: commune.id,
      name: commune.name,
      population: commune.population,
      forecast,
      intervalLow: Math.max(0, forecast - intervalMargin),
      intervalHigh: forecast + intervalMargin,
      observed,
      mae,
      rate,
      risk: getRiskLevel(monthlyEquivalent),
      changePct: commune.changePct,
      monthlyEquivalent,
      trend,
    }
  })
}

export function getChangePercent(rows: CommuneMetric[], periodIndex: number) {
  if (rows.length === 1) {
    return rows[0].changePct + (periodIndex === 1 ? 1.4 : periodIndex === 2 ? -1.2 : 0)
  }

  return [8.4, 5.6, -1.8][periodIndex] ?? 8.4
}

export type TrendPoint = {
  period: string
  observed: number | null
  forecast: number | null
  lowerBase: number | null
  intervalRange: number | null
  forecastPeriod: boolean
}

const trendByScale: Record<Scale, { periods: string[]; observed: number[]; forecast: number[]; observedCount: number }> = {
  diaria: {
    periods: ["20 ago", "21 ago", "22 ago", "23 ago", "24 ago", "25 ago", "26 ago", "27 ago", "28 ago", "29 ago", "30 ago", "31 ago", "01 sep", "02 sep", "03 sep", "04 sep"],
    observed: [14, 12, 15, 13, 16, 14, 12, 17, 15, 13, 16, 14],
    forecast: [15, 17, 16, 18],
    observedCount: 12,
  },
  semanal: {
    periods: ["16 jun", "23 jun", "30 jun", "07 jul", "14 jul", "21 jul", "28 jul", "04 ago", "11 ago", "18 ago", "25 ago", "01 sep"],
    observed: [62, 58, 67, 64, 69, 65, 72, 68],
    forecast: [70, 73, 76, 72],
    observedCount: 8,
  },
  mensual: {
    periods: ["sep 24", "oct", "nov", "dic", "ene 25", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    observed: [328, 342, 335, 351, 366, 358, 372, 364, 381, 390, 376, 394],
    forecast: [401, 408, 414, 398],
    observedCount: 12,
  },
}

export function getTrendSeries(
  scale: Scale,
  periodIndex = 0,
  communeId?: number
): TrendPoint[] {
  const source = trendByScale[scale]
  const commune = communeId ? communeSeeds.find((item) => item.id === communeId) : undefined
  const share = commune
    ? commune.monthlyBase / communeSeeds.reduce((total, item) => total + item.monthlyBase, 0)
    : 1
  const adjustment = periodAdjustments[periodIndex] ?? 1
  const scaleValue = (value: number) =>
    commune ? Math.round(value * share * 10) / 10 : value

  return source.periods.map((period, index) => {
    if (index < source.observedCount) {
      const observed = scaleValue(source.observed[index])
      const isLastObserved = index === source.observedCount - 1

      return {
        period,
        observed,
        forecast: isLastObserved ? observed : null,
        lowerBase: null,
        intervalRange: null,
        forecastPeriod: false,
      }
    }

    const baseForecast = source.forecast[index - source.observedCount] ?? 0
    const forecast = scaleValue(baseForecast * adjustment)
    const margin = Math.max(commune ? 0.3 : 1, Math.round(forecast * 0.11 * 10) / 10)

    return {
      period,
      observed: null,
      forecast,
      lowerBase: Math.max(0, forecast - margin),
      intervalRange: margin * 2,
      forecastPeriod: true,
    }
  })
}

export const monthlySeasonality = [
  { month: "Ene", accidents: 336 },
  { month: "Feb", accidents: 321 },
  { month: "Mar", accidents: 355 },
  { month: "Abr", accidents: 342 },
  { month: "May", accidents: 376 },
  { month: "Jun", accidents: 398 },
  { month: "Jul", accidents: 402 },
  { month: "Ago", accidents: 390 },
  { month: "Sep", accidents: 374 },
  { month: "Oct", accidents: 415 },
  { month: "Nov", accidents: 389 },
  { month: "Dic", accidents: 429 },
]

export const yearlyTrend = [
  { year: "2021", accidents: 3_120 },
  { year: "2022", accidents: 3_350 },
  { year: "2023", accidents: 3_590 },
  { year: "2024", accidents: 3_798 },
  { year: "2025*", accidents: 2_645 },
]

export const timeHeatmap = [
  { day: "Lunes", values: [6, 12, 14, 15] },
  { day: "Martes", values: [5, 11, 13, 16] },
  { day: "Miércoles", values: [4, 12, 15, 17] },
  { day: "Jueves", values: [5, 13, 17, 20] },
  { day: "Viernes", values: [6, 14, 19, 24] },
  { day: "Sábado", values: [8, 17, 22, 21] },
  { day: "Domingo", values: [7, 12, 15, 13] },
]

export const timeSlots = ["Madrugada", "Mañana", "Tarde", "Noche"]

export const modelScores = [
  {
    name: "Persistencia",
    description: "El último periodo observado como referencia",
    scores: {
      diaria: { mae: 2.8, rmse: 4.2 },
      semanal: { mae: 14.8, rmse: 21.1 },
      mensual: { mae: 62.5, rmse: 89.6 },
    },
  },
  {
    name: "Promedio estacional",
    description: "Promedio histórico para la misma temporada",
    scores: {
      diaria: { mae: 2.4, rmse: 3.8 },
      semanal: { mae: 12.2, rmse: 18.0 },
      mensual: { mae: 53.4, rmse: 77.1 },
    },
  },
  {
    name: "Gradient Boosting",
    description: "Variables temporales y rezagos por comuna",
    scores: {
      diaria: { mae: 2.1, rmse: 3.4 },
      semanal: { mae: 10.6, rmse: 16.3 },
      mensual: { mae: 48.1, rmse: 70.2 },
    },
  },
  {
    name: "Gradient Boosting + población",
    description: "Incluye población estimada por 100.000 habitantes",
    scores: {
      diaria: { mae: 2.0, rmse: 3.2 },
      semanal: { mae: 9.8, rmse: 15.1 },
      mensual: { mae: 45.6, rmse: 67.8 },
    },
  },
] as const
