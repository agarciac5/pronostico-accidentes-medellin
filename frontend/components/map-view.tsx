"use client"

import { useState, type ComponentProps } from "react"
import { Info, MapPin, MousePointer2 } from "lucide-react"
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps"
import geojson from "@/lib/medellin-comunas.json"
import {
  DataNotice,
  formatCount,
  formatDecimal,
  PanelHeading,
  RiskBadge,
} from "@/components/dashboard-shared"
import {
  getRiskLevel,
  getScaleFactor,
  type CommuneMetric,
  type RiskLevel,
  type Scale,
} from "@/lib/mobility-data"

type MapProperties = {
  id: number
  codigo: string
  nombre: string
  center: [number, number]
}

type MapFeature = {
  type: "Feature"
  properties: MapProperties
  geometry: unknown
}

type MapViewProps = {
  rows: CommuneMetric[]
  scale: Scale
  periodLabel: string
  selectedCommune: string
  onSelectCommune: (value: string) => void
}

const riskColors: Record<RiskLevel, string> = {
  Bajo: "#dce9df",
  Medio: "#f1dfb8",
  Alto: "#e6c2bd",
}

const features = geojson.features as MapFeature[]
const mapSource = geojson as unknown as ComponentProps<typeof Geographies>["geography"]

export function MapView({
  rows,
  scale,
  periodLabel,
  selectedCommune,
  onSelectCommune,
}: MapViewProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [localSelectedId, setLocalSelectedId] = useState(10)
  const [viewMode, setViewMode] = useState<"forecast" | "observed">("forecast")
  const activeId = selectedCommune === "all" ? hoveredId ?? localSelectedId : Number(selectedCommune)
  const activeMetric = rows.find((row) => row.id === activeId) ?? rows[0]
  const activeValue = activeMetric
    ? viewMode === "forecast" ? activeMetric.forecast : activeMetric.observed
    : 0
  const activeRisk = activeMetric
    ? getRiskLevel(viewMode === "forecast" ? activeMetric.monthlyEquivalent : activeMetric.observed / getScaleFactor(scale))
    : "Bajo"
  const rankedRows = [...rows].sort((first, second) => {
    const firstValue = viewMode === "forecast" ? first.forecast : first.observed
    const secondValue = viewMode === "forecast" ? second.forecast : second.observed
    return secondValue - firstValue
  })
  const activeRank = activeMetric ? rankedRows.findIndex((row) => row.id === activeMetric.id) + 1 : 0

  function selectMapCommune(id: number) {
    setLocalSelectedId(id)
    onSelectCommune(String(id))
  }

  function getMetric(id: number) {
    return rows.find((row) => row.id === id)
  }

  function getRisk(row: CommuneMetric): RiskLevel {
    return viewMode === "forecast"
      ? row.risk
      : getRiskLevel(row.observed / getScaleFactor(scale))
  }

  return (
    <div className="view-stack">
      <DataNotice>
        El color resume el nivel relativo por comuna; no muestra ubicaciones de personas ni puntos de accidentes. La geometría corresponde a GeoMedellín.
      </DataNotice>

      <section className="map-layout-grid" aria-label="Mapa y detalle de concentración por comuna">
        <article className="surface-card map-card">
          <div className="surface-card-header map-card-header">
            <PanelHeading
              title="Concentración por comuna"
              description={`${viewMode === "forecast" ? "Pronóstico" : "Histórico de referencia"} · ${periodLabel}`}
              action={
                <div className="segmented-control" role="group" aria-label="Modo de visualización del mapa">
                  <button
                    type="button"
                    aria-pressed={viewMode === "observed"}
                    className={viewMode === "observed" ? "is-selected" : ""}
                    onClick={() => setViewMode("observed")}
                  >
                    Histórico
                  </button>
                  <button
                    type="button"
                    aria-pressed={viewMode === "forecast"}
                    className={viewMode === "forecast" ? "is-selected" : ""}
                    onClick={() => setViewMode("forecast")}
                  >
                    Pronóstico
                  </button>
                </div>
              }
            />
          </div>

          <figure className="map-figure">
            <div className="map-canvas" role="group" aria-label="Mapa interactivo de las 16 comunas urbanas de Medellín">
              <ComposableMap
                width={600}
                height={500}
                projection="geoMercator"
                projectionConfig={{ center: [-75.5785, 6.2442], scale: 164000 }}
                aria-label="Comunas de Medellín coloreadas por nivel de riesgo"
              >
                <Geographies geography={mapSource}>
                  {({ geographies }) =>
                    geographies.map((geography) => {
                      const properties = geography.properties as MapProperties
                      const id = Number(properties.id ?? properties.codigo)
                      const row = getMetric(id)
                      const risk = row ? getRisk(row) : "Bajo"
                      const selected = activeId === id
                      const fill = row ? riskColors[risk] : "#e7ece9"

                      return (
                        <Geography
                          key={geography.rsmKey}
                          geography={geography}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          aria-label={`${properties.nombre}, riesgo ${risk}${row ? `, ${formatCount(viewMode === "forecast" ? row.forecast : row.observed)} accidentes` : ""}`}
                          onMouseEnter={() => setHoveredId(id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onFocus={() => setHoveredId(id)}
                          onClick={() => selectMapCommune(id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              selectMapCommune(id)
                            }
                          }}
                          style={{
                            fill,
                            stroke: selected || hoveredId === id ? "#344b40" : "#ffffff",
                            strokeWidth: selected || hoveredId === id ? 2.1 : 1.15,
                            outline: "none",
                            transition: "fill 120ms ease, stroke-width 120ms ease",
                          }}
                        />
                      )
                    })
                  }
                </Geographies>
                {features.map((feature) => (
                  <Marker key={feature.properties.id} coordinates={feature.properties.center}>
                    <text
                      className={`map-label ${activeId === feature.properties.id ? "map-label--active" : ""}`}
                      textAnchor="middle"
                      dominantBaseline="central"
                      aria-hidden="true"
                    >
                      {feature.properties.codigo}
                    </text>
                  </Marker>
                ))}
              </ComposableMap>
            </div>
            <figcaption className="map-caption">
              <span><MousePointer2 size={14} aria-hidden="true" /> Selecciona una comuna para ver su detalle.</span>
              <a
                href="https://www.medellin.gov.co/geomedellin/"
                target="_blank"
                rel="noreferrer"
              >
                Límites: GeoMedellín
              </a>
            </figcaption>
          </figure>

          <div className="map-legend" aria-label="Leyenda de niveles de riesgo">
            <span className="map-legend-title">Intensidad relativa</span>
            <span><i className="map-swatch map-swatch--low" /> Bajo</span>
            <span><i className="map-swatch map-swatch--medium" /> Medio</span>
            <span><i className="map-swatch map-swatch--high" /> Alto</span>
          </div>
        </article>

        <aside className="surface-card map-detail-card" aria-live="polite" aria-label="Detalle de la comuna seleccionada">
          <div className="map-detail-topline">
            <span className="map-detail-icon"><MapPin size={17} aria-hidden="true" /></span>
            <span>COMUNA {activeMetric ? String(activeMetric.id).padStart(2, "0") : "—"}</span>
          </div>
          <h2>{activeMetric?.name ?? "Selecciona una comuna"}</h2>
          <p className="map-detail-subtitle">
            {viewMode === "forecast" ? "Estimación para" : "Referencia observada para"} {periodLabel}
          </p>

          <div className="map-detail-risk-row">
            <span>Nivel de intensidad</span>
            <RiskBadge level={activeRisk} />
          </div>

          <div className="map-detail-primary">
            <span>{viewMode === "forecast" ? "Accidentes pronosticados" : "Accidentes observados"}</span>
            <strong>{activeMetric ? formatCount(activeValue) : "—"}</strong>
            {viewMode === "forecast" && activeMetric ? (
              <small>Rango de referencia: {formatCount(activeMetric.intervalLow)}–{formatCount(activeMetric.intervalHigh)}</small>
            ) : null}
          </div>

          <div className="map-detail-stats">
            <div>
              <span>Por 100.000 hab.</span>
              <strong>{activeMetric ? formatDecimal(activeMetric.rate) : "—"}</strong>
            </div>
            <div>
              <span>Posición relativa</span>
              <strong>{activeRank ? `${activeRank} de ${rows.length}` : "—"}</strong>
            </div>
          </div>

          <div className="map-detail-note">
            <Info size={15} aria-hidden="true" />
            <p>El color agrupa valores por nivel relativo; la tasa se calcula sobre la población de cada comuna.</p>
          </div>
        </aside>
      </section>
    </div>
  )
}
