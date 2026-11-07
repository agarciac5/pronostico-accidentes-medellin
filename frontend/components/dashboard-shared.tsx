import type { LucideIcon } from "lucide-react"
import type { RiskLevel } from "@/lib/mobility-data"

export function formatCount(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)
}

export function formatDecimal(value: number, fractionDigits = 1) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

type MetricCardProps = {
  title: string
  value: string
  detail: string
  icon: LucideIcon
  tone?: "blue" | "teal" | "orange" | "violet"
  valueClassName?: string
}

export function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "blue",
  valueClassName,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon--${tone}`} aria-hidden="true">
        <Icon size={20} strokeWidth={2.4} />
      </div>
      <p className="metric-title">{title}</p>
      <p className={`metric-value ${valueClassName ?? ""}`}>{value}</p>
      <p className="metric-detail">{detail}</p>
    </article>
  )
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`risk-badge risk-badge--${level.toLowerCase()}`}>{level}</span>
}

export function DataNotice({ children }: { children: React.ReactNode }) {
  return (
    <aside className="data-notice" role="note">
      <span className="data-notice-icon" aria-hidden="true">i</span>
      <p>{children}</p>
    </aside>
  )
}

export function PanelHeading({
  title,
  description,
  action,
  titleId,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  titleId?: string
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2 id={titleId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="panel-heading-action">{action}</div> : null}
    </div>
  )
}

export function SparkBars({ values, label }: { values: number[]; label: string }) {
  const maxValue = Math.max(...values, 1)

  return (
    <div className="spark-bars" role="img" aria-label={label}>
      {values.map((value, index) => (
        <span
          key={`${label}-${index}`}
          style={{ height: `${Math.max(14, (value / maxValue) * 100)}%` }}
        />
      ))}
    </div>
  )
}
