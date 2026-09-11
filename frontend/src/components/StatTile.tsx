import { TrendDown, TrendUp, type Icon } from "@phosphor-icons/react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

const TILE_TONE_CLASSES = {
  info: "bg-info text-info-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  pending: "bg-pending text-pending-foreground",
} as const;

const TILE_GRADIENT_CLASSES = {
  info: "from-card to-info/50",
  success: "from-card to-success/50",
  warning: "from-card to-warning/50",
  pending: "from-card to-pending/50",
} as const;

export type StatTileTone = keyof typeof TILE_TONE_CLASSES;

/** Compact stat card with an optional real sparkline + week-over-week trend badge —
 * both must be derived from actual timestamped data (see src/lib/trend.ts); omit
 * rather than fabricate for metrics with no history behind them (e.g. static totals
 * on tables with no created_at column). */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  sparkline,
  trend,
}: {
  label: string;
  value: number;
  icon: Icon;
  tone: StatTileTone;
  sparkline?: number[];
  trend?: { percent: number; label: string };
}) {
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br p-3 ${TILE_GRADIENT_CLASSES[tone]}`}>
      <div className="mb-1.5 flex items-start justify-between">
        <div className={`inline-flex rounded-xl p-1.5 ${TILE_TONE_CLASSES[tone]}`}>
          <Icon size={16} aria-hidden="true" />
        </div>
        {sparkline && sparkline.length > 1 && (
          <div className="h-6 w-14" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline.map((v) => ({ v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--color-accent)"
                  fill={`url(#spark-${label})`}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-bold text-foreground">{value.toLocaleString("vi-VN")}</span>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              trend.percent >= 0 ? "text-success-foreground" : "text-danger-foreground"
            }`}
          >
            {trend.percent >= 0 ? (
              <TrendUp size={12} weight="bold" aria-hidden="true" />
            ) : (
              <TrendDown size={12} weight="bold" aria-hidden="true" />
            )}
            {trend.percent >= 0 ? "+" : ""}
            {trend.percent}%
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {trend && <div className="text-[10px] text-muted-foreground">{trend.label}</div>}
    </div>
  );
}
