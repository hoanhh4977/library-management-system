export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

/** Buckets ISO timestamps into a daily count series for the trailing `days` window
 * (oldest first) — shared by every stat-tile sparkline that derives from a raw
 * timestamp field rather than a pre-aggregated report endpoint. */
export function bucketByDay(timestamps: string[], days: number): number[] {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const buckets = new Array(days).fill(0);
  for (const ts of timestamps) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const dayIndex = days - 1 - Math.round((todayMidnight.getTime() - d.getTime()) / 86_400_000);
    if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex] += 1;
  }
  return buckets;
}

/** Like bucketByDay, but sums a per-timestamp weight (e.g. loan quantity) instead of
 * just counting occurrences. */
export function bucketWeightedByDay(entries: [string, number][], days: number): number[] {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const buckets = new Array(days).fill(0);
  for (const [ts, weight] of entries) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const dayIndex = days - 1 - Math.round((todayMidnight.getTime() - d.getTime()) / 86_400_000);
    if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex] += weight;
  }
  return buckets;
}

/** Week-over-week % change for a FLOW series (daily counts, e.g. borrows or new
 * requests per day) — compares the sum of the last 7 days against the 7 before that.
 * Undefined when the prior week has no baseline (would be a meaningless ±Infinity%). */
export function weekOverWeek(dailySeries: number[]): { percent: number; label: string } | undefined {
  if (dailySeries.length < 14) return undefined;
  const days = dailySeries.slice(-14);
  const prevWeek = days.slice(0, 7).reduce((sum, v) => sum + v, 0);
  const lastWeek = days.slice(7).reduce((sum, v) => sum + v, 0);
  if (prevWeek === 0) return undefined;
  return { percent: Math.round(((lastWeek - prevWeek) / prevWeek) * 100), label: "So với 7 ngày trước" };
}

/** Reconstructs, for each of the last `days` days, how many of the given requests were
 * still pending AT THE END of that day — exact history from `requested_at`/`status`/
 * `reviewed_at` (a request counts as pending on day D if it existed by then and either
 * is still pending now, or wasn't resolved until after D). This is a STOCK/level
 * series (a backlog size at a point in time), not a flow — pair it with
 * weekOverWeekLevel, never weekOverWeek (which would compare daily arrival counts,
 * a different, unrelated number from the "currently pending" headline it'd sit under). */
export function pendingCountSeries(
  items: { requested_at: string; status: string; reviewed_at: string | null }[],
  days: number,
): number[] {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const series: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayEnd = new Date(todayMidnight);
    dayEnd.setDate(dayEnd.getDate() - i + 1);
    const count = items.filter((item) => {
      if (new Date(item.requested_at) >= dayEnd) return false;
      if (item.status === "pending") return true;
      if (!item.reviewed_at) return true;
      return new Date(item.reviewed_at) >= dayEnd;
    }).length;
    series.push(count);
  }
  return series;
}

/** Week-over-week % change for a STOCK series (a running/cumulative total, e.g. total
 * active members over time) — compares today's level against the level 7 days ago,
 * not summed weekly totals (which would distort a monotonically-growing series). */
export function weekOverWeekLevel(cumulativeSeries: number[]): { percent: number; label: string } | undefined {
  if (cumulativeSeries.length < 14) return undefined;
  const now = cumulativeSeries[cumulativeSeries.length - 1];
  const weekAgo = cumulativeSeries[cumulativeSeries.length - 8];
  if (weekAgo === 0) return undefined;
  return { percent: Math.round(((now - weekAgo) / weekAgo) * 100), label: "So với 7 ngày trước" };
}
