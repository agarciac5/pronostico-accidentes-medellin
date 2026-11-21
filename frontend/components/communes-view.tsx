"use client"

import { useMemo, useState } from "react"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Search,
} from "lucide-react"
import {
  DataNotice,
  formatCount,
  formatDecimal,
  PanelHeading,
  RiskBadge,
  SparkBars,
} from "@/components/dashboard-shared"
import type { CommuneMetric } from "@/lib/mobility-data"

type SortKey = "name" | "forecast" | "mae"
type SortDirection = "asc" | "desc"

type CommunesViewProps = {
  rows: CommuneMetric[]
  periodLabel: string
}

export function CommunesView({ rows, periodLabel }: CommunesViewProps) {
  const [query, setQuery] = useState("")
  const [riskFilter, setRiskFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("forecast")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [pageIndex, setPageIndex] = useState(0)
  const [exportMessage, setExportMessage] = useState("")
  const pageSize = 8

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-CO")

    return rows.filter((row) => {
      const matchesQuery = row.name.toLocaleLowerCase("es-CO").includes(normalizedQuery)
      const matchesRisk = riskFilter === "all" || row.risk.toLowerCase() === riskFilter
      return matchesQuery && matchesRisk
    })
  }, [query, riskFilter, rows])

  const sortedRows = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1

    return [...filteredRows].sort((first, second) => {
      if (sortKey === "name") return first.name.localeCompare(second.name, "es") * direction
      return (first[sortKey] - second[sortKey]) * direction
    })
  }, [filteredRows, sortDirection, sortKey])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const visibleRows = sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const firstVisible = sortedRows.length ? currentPage * pageSize + 1 : 0
  const lastVisible = Math.min((currentPage + 1) * pageSize, sortedRows.length)

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc")
    } else {
      setSortKey(nextKey)
      setSortDirection(nextKey === "name" ? "asc" : "desc")
    }
    setPageIndex(0)
  }

  function resetFilters() {
    setQuery("")
    setRiskFilter("all")
    setPageIndex(0)
  }

  function exportCsv() {
    const headers = [
      "Comuna",
      "Pronóstico",
      "Observado",
      "MAE",
      "Intensidad relativa",
    ]
    const values = sortedRows.map((row) => [
      row.name,
      row.forecast,
      row.observed,
      row.mae,
      row.risk,
    ])
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
    const content = [headers, ...values].map((line) => line.map(escapeCsv).join(",")).join("\r\n")
    const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "pronostico-comunas.csv"
    link.click()
    URL.revokeObjectURL(url)
    setExportMessage("CSV exportado con los filtros actuales.")
  }

  const riskOptions: { value: string; label: string }[] = [
    { value: "all", label: "Todos los niveles" },
    { value: "alto", label: "Alto" },
    { value: "medio", label: "Medio" },
    { value: "bajo", label: "Bajo" },
  ]

  return (
    <div className="view-stack">
      <DataNotice>
        Consulta predicciones diarias retrospectivas y observados reales. MAE calculado en toda la validación sep–dic 2024.
      </DataNotice>

      <section className="surface-card table-card" aria-labelledby="commune-table-title">
        <div className="surface-card-header table-card-header">
          <PanelHeading
            title="¿Cuántos accidentes se estiman en cada comuna?"
            titleId="commune-table-title"
            description={`${periodLabel} · estimación de accidentes con víctimas`}
            action={
              <button className="secondary-button" type="button" onClick={exportCsv}>
                <Download size={16} aria-hidden="true" />
                <span>Exportar CSV</span>
              </button>
            }
          />
        </div>

        <div className="table-toolbar">
          <div className="table-filters">
            <label className="table-search-field" htmlFor="commune-search">
              <span>Buscar comuna</span>
              <span className="search-input-wrap">
                <Search size={16} aria-hidden="true" />
                <input
                  id="commune-search"
                  type="search"
                  placeholder="Ej. Laureles-Estadio"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPageIndex(0)
                  }}
                />
              </span>
            </label>
            <label className="table-select-field" htmlFor="risk-filter">
              <span>Intensidad relativa</span>
              <select
                id="risk-filter"
                value={riskFilter}
                onChange={(event) => {
                  setRiskFilter(event.target.value)
                  setPageIndex(0)
                }}
              >
                {riskOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="table-toolbar-meta">
            <span className="result-count" aria-live="polite">
              {sortedRows.length} {sortedRows.length === 1 ? "resultado" : "resultados"}
            </span>
            <button className="quiet-button" type="button" onClick={resetFilters}>
              <RotateCcw size={14} aria-hidden="true" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        </div>

        {exportMessage ? <p className="export-status" role="status">{exportMessage}</p> : null}

        {sortedRows.length ? (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">Pronóstico de accidentes con víctimas por comuna para {periodLabel}</caption>
                <thead>
                  <tr>
                    <SortableHeader label="Comuna" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <SortableHeader label="Pronóstico" sortKey="forecast" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <th scope="col">Observado</th>
                    <SortableHeader label="MAE" sortKey="mae" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                    <th scope="col">Intensidad</th>
                    <th scope="col">Últimos 7 días observados</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className="commune-name-cell">
                        <span className="commune-number">{String(row.id).padStart(2, "0")}</span>
                        <span>{row.name}</span>
                      </th>
                      <td className="numeric-cell numeric-cell--strong">{formatDecimal(row.forecast)}</td>
                      <td className="numeric-cell">{formatCount(row.observed)}</td>
                      <td className="numeric-cell">{formatDecimal(row.mae)}</td>
                      <td><RiskBadge level={row.risk} /></td>
                      <td><SparkBars values={row.trend} label={`Tendencia reciente de ${row.name}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-pagination">
              <span className="pagination-caption">
                Mostrando <strong>{firstVisible}–{lastVisible}</strong> de <strong>{sortedRows.length}</strong> comunas
              </span>
              <div className="pagination-actions">
                <button
                  className="pagination-button"
                  type="button"
                  onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                  disabled={currentPage === 0}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="pagination-page" aria-live="polite">{currentPage + 1} / {pageCount}</span>
                <button
                  className="pagination-button"
                  type="button"
                  onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
                  disabled={currentPage >= pageCount - 1}
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="table-empty-state">
            <span className="empty-state-icon"><Search size={20} aria-hidden="true" /></span>
            <h3>No encontramos comunas</h3>
            <p>Prueba otro nombre o cambia el nivel de intensidad seleccionado.</p>
            <button className="secondary-button" type="button" onClick={resetFilters}>Restablecer filtros</button>
          </div>
        )}
      </section>

      <p className="table-footnote">
        El MAE resume 121 días evaluados por comuna. Intensidad: tercios del máximo pronosticado entre las 16 comunas; no mide riesgo individual.
      </p>
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
}) {
  const active = activeKey === sortKey

  return (
    <th scope="col" aria-sort={active ? direction === "asc" ? "ascending" : "descending" : "none"}>
      <button
        className={`table-sort-button ${active ? "table-sort-button--active" : ""}`}
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Ordenar por ${label}${active ? direction === "asc" ? ", ascendente" : ", descendente" : ""}`}
      >
        <span>{label}</span>
        <ArrowUpDown size={13} aria-hidden="true" />
      </button>
    </th>
  )
}
