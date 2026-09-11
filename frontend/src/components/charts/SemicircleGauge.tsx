interface GaugeSegment {
  label: string;
  value: number;
  color: string;
}

const RADIUS = 80;
const STROKE = 18;
const CENTER = 100;

function polarToCartesian(angleDeg: number) {
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(angleRad),
    y: CENTER + RADIUS * Math.sin(angleRad),
  };
}

function describeArc(startAngle: number, endAngle: number) {
  const start = polarToCartesian(endAngle);
  const end = polarToCartesian(startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

/** Half-donut gauge — ref: Bookary "Stock Overview". Segments are drawn left-to-right
 * in the order given; an all-zero total renders a single neutral track arc instead of
 * a division-by-zero gauge. Center label + a below-chart legend/table carry the same
 * data as text, so the arc itself is decorative (`chart` a11y fallback pattern). */
export function SemicircleGauge({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: GaugeSegment[];
  centerLabel: string;
  centerValue: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const rawArcs =
    total === 0
      ? [{ label: "", value: 1, color: "var(--color-chart-track)" }]
      : segments.filter((s) => s.value > 0);
  const arcTotal = total === 0 ? 1 : total;

  const arcs = rawArcs.reduce<Array<{ color: string; startAngle: number; endAngle: number }>>(
    (acc, segment) => {
      const previousEnd = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const sweep = (segment.value / arcTotal) * 180;
      acc.push({ color: segment.color, startAngle: previousEnd, endAngle: previousEnd + sweep });
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[170px]" role="presentation">
        {arcs.map((arc, index) => {
          return (
            <path
              key={index}
              d={describeArc(arc.startAngle, arc.endAngle)}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeLinecap={arcs.length > 1 ? "butt" : "round"}
            />
          );
        })}
      </svg>
      <div className="-mt-9 flex flex-col items-center text-center">
        <span className="font-mono text-xl font-bold text-foreground">
          {centerValue.toLocaleString("vi-VN")}
        </span>
        <span className="text-xs text-muted-foreground">{centerLabel}</span>
      </div>
    </div>
  );
}
