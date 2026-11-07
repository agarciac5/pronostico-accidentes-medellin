"use client"

import { useEffect, useState } from "react"
import {
  BookOpenCheck,
  CalendarClock,
  CarFront,
  ChartNoAxesCombined,
  Gauge,
  MapPinned,
  Menu,
  TableProperties,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  getCommuneRows,
  type Scale,
} from "@/lib/mobility-data"
import { CommunesView } from "@/components/communes-view"
import { MapView } from "@/components/map-view"
import { MethodologyView } from "@/components/methodology-view"
import { ModelView } from "@/components/model-view"
import { PatternsView } from "@/components/patterns-view"
import { SummaryView } from "@/components/summary-view"

type SectionId = "summary" | "communes" | "map" | "patterns" | "model" | "methodology"
type NavigationTone = "blue" | "teal" | "orange" | "violet"

type NavigationItem = {
  id: SectionId
  title: string
  description: string
  icon: LucideIcon
  tone: NavigationTone
}

const navigation: NavigationItem[] = [
  {
    id: "summary",
    title: "Resumen",
    description: "Visión general del pronóstico",
    icon: Gauge,
    tone: "blue",
  },
  {
    id: "communes",
    title: "Pronóstico por comuna",
    description: "Estimaciones y métricas locales",
    icon: TableProperties,
    tone: "teal",
  },
  {
    id: "map",
    title: "Concentración geográfica",
    description: "Mapa de riesgo por comuna",
    icon: MapPinned,
    tone: "orange",
  },
  {
    id: "patterns",
    title: "Patrones temporales",
    description: "Días y franjas de mayor actividad",
    icon: CalendarClock,
    tone: "violet",
  },
  {
    id: "model",
    title: "Desempeño del modelo",
    description: "Comparación de modelos y error",
    icon: ChartNoAxesCombined,
    tone: "blue",
  },
  {
    id: "methodology",
    title: "Metodología y datos",
    description: "Fuentes, proceso y limitaciones",
    icon: BookOpenCheck,
    tone: "teal",
  },
]

const periodOptions: Record<Scale, string[]> = {
  diaria: ["1 sep 2025", "2 sep 2025", "3 sep 2025"],
  semanal: ["1–7 sep 2025", "8–14 sep 2025", "15–21 sep 2025"],
  mensual: ["sep 2025", "oct 2025", "nov 2025"],
}

const scaleOptions: { value: Scale; label: string }[] = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
]

export function MobilityDashboard() {
  const [activeSection, setActiveSection] = useState<SectionId>("summary")
  const [scale, setScale] = useState<Scale>("semanal")
  const [periodIndex, setPeriodIndex] = useState(0)
  const [selectedCommune, setSelectedCommune] = useState("all")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsReady(true), 420)
    return () => window.clearTimeout(timer)
  }, [])

  const page = navigation.find((item) => item.id === activeSection) ?? navigation[0]
  const allRows = getCommuneRows(scale, periodIndex)
  const selectedRow = allRows.find((row) => String(row.id) === selectedCommune)
  const visibleRows = selectedCommune === "all" ? allRows : allRows.filter((row) => String(row.id) === selectedCommune)
  const selectedCommuneName = selectedRow?.name ?? "Todas las comunas"
  const currentPeriod = periodOptions[scale][periodIndex] ?? periodOptions[scale][0]
  const showCommuneFilter = ["summary", "communes", "map"].includes(activeSection)
  const selectedCommuneId = selectedCommune === "all" ? undefined : Number(selectedCommune)

  function changeScale(nextScale: Scale) {
    setScale(nextScale)
    setPeriodIndex(0)
  }

  function openSection(section: SectionId) {
    setActiveSection(section)
    setMobileNavOpen(false)
  }

  return (
    <div className="app-shell">
      {mobileNavOpen ? (
        <button
          className="mobile-scrim"
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Cerrar navegación"
        />
      ) : null}

      <aside
        className={`sidebar ${mobileNavOpen ? "sidebar--open" : ""}`}
        aria-label="Navegación principal"
        role={mobileNavOpen ? "dialog" : undefined}
        aria-modal={mobileNavOpen ? true : undefined}
      >
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <CarFront size={22} strokeWidth={2.5} />
          </span>
          <span className="brand-copy">
            <strong>Movilidad</strong>
            <small>Medellín · Observatorio vial</small>
          </span>
          <button
            className="sidebar-close icon-button"
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div className="sidebar-label">ANÁLISIS</div>
        <nav className="sidebar-nav">
          {navigation.map(({ id, title, icon: Icon, tone }) => (
            <button
              key={id}
              type="button"
              className={`nav-item ${activeSection === id ? "nav-item--active" : ""}`}
              onClick={() => openSection(id)}
              aria-current={activeSection === id ? "page" : undefined}
            >
              <span className={`nav-icon-tile nav-icon-tile--${tone}`} aria-hidden="true">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              <span>{title}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
      </aside>

      <div className="main-column">
        <header className="dashboard-header">
          <div className="header-title-block">
            <button
              className="mobile-menu-button icon-button"
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir navegación"
              aria-expanded={mobileNavOpen}
            >
              <Menu size={20} strokeWidth={2.4} />
            </button>
            <div>
              <div className="header-overline">
                <span>OBSERVATORIO DE SEGURIDAD VIAL</span>
              </div>
              <h1>{page.title}</h1>
              <p>{page.description}</p>
            </div>
          </div>

          <div className="header-action-row">
            <div className="header-controls" aria-label="Filtros del tablero">
              <label className="header-select">
                <span>Escala</span>
                <select
                  aria-label="Escala temporal"
                  value={scale}
                  onChange={(event) => changeScale(event.target.value as Scale)}
                >
                  {scaleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="header-select header-select--period">
                <span>Periodo</span>
                <select
                  aria-label="Periodo de pronóstico"
                  value={periodIndex}
                  onChange={(event) => setPeriodIndex(Number(event.target.value))}
                >
                  {periodOptions[scale].map((period, index) => (
                    <option key={period} value={index}>
                      {period}
                    </option>
                  ))}
                </select>
              </label>
              {showCommuneFilter ? (
                <label className="header-select header-select--commune">
                  <span>Comuna</span>
                  <select
                    aria-label="Filtrar por comuna"
                    value={selectedCommune}
                    onChange={(event) => setSelectedCommune(event.target.value)}
                  >
                    <option value="all">Todas las comunas</option>
                    {allRows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <button
              className="header-help-button"
              type="button"
              onClick={() => openSection("methodology")}
              aria-label="Ver metodología y fuentes"
              title="Metodología y fuentes"
            >
              <BookOpenCheck size={18} strokeWidth={2.4} />
            </button>
          </div>
        </header>

        <main className="workspace-content" id="contenido-principal">
          {!isReady ? (
            <DashboardSkeleton />
          ) : activeSection === "summary" ? (
            <SummaryView
              rows={visibleRows}
              scale={scale}
              periodIndex={periodIndex}
              periodLabel={currentPeriod}
              selectedCommuneId={selectedCommuneId}
              selectedCommuneName={selectedCommuneName}
            />
          ) : activeSection === "communes" ? (
            <CommunesView rows={visibleRows} periodLabel={currentPeriod} />
          ) : activeSection === "map" ? (
            <MapView
              rows={allRows}
              scale={scale}
              periodLabel={currentPeriod}
              selectedCommune={selectedCommune}
              onSelectCommune={setSelectedCommune}
            />
          ) : activeSection === "patterns" ? (
            <PatternsView periodLabel={currentPeriod} />
          ) : activeSection === "model" ? (
            <ModelView rows={visibleRows} scale={scale} selectedCommuneName={selectedCommuneName} />
          ) : (
            <MethodologyView />
          )}
        </main>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Cargando el tablero" aria-busy="true">
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <span className="skeleton-block skeleton-block--icon" />
            <span className="skeleton-block skeleton-block--label" />
            <span className="skeleton-block skeleton-block--value" />
            <span className="skeleton-block skeleton-block--caption" />
          </div>
        ))}
      </div>
      <div className="skeleton-content-grid">
        <div className="skeleton-card skeleton-card--chart">
          <span className="skeleton-block skeleton-block--title" />
          <span className="skeleton-block skeleton-block--chart-area" />
        </div>
        <div className="skeleton-card skeleton-card--list">
          <span className="skeleton-block skeleton-block--title" />
          {Array.from({ length: 5 }, (_, index) => (
            <span className="skeleton-block skeleton-block--row" key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
