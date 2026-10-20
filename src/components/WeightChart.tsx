import { fromDateKey, type DateKey } from "../lib/dates";
import { kgToLb, kgToStone, type Period, type WeighInWithTrend, type WeightUnit } from "../lib/progress";
import { linear, niceTicks } from "../lib/scale";
import { CHART_ON_TARGET, INK, PAPER, RULE, TRACK } from "../theme";

interface Props {
  period: Period;
  days: DateKey[];
  points: WeighInWithTrend[];
  unit: WeightUnit;
  selected: DateKey | null;
  onSelect: (date: DateKey) => void;
}

const W = 340;
const H = 180;
const M = { top: 12, right: 10, bottom: 24, left: 48 };

/** Kilograms for kg; pounds for lb and stone (stone ticks are labelled as st + lb). */
function toAxis(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : kgToLb(kg);
}

function tickLabel(value: number, unit: WeightUnit): string {
  if (unit === "kg") return String(value);
  if (unit === "lb") return String(Math.round(value));
  const { stone, lb } = kgToStone(value / 2.2046226218);
  return `${stone}st ${Math.round(lb)}`;
}

/** Weigh-ins as dots with the 7-day trend as a line, across the period's days. */
export default function WeightChart({ period, days, points, unit, selected, onSelect }: Props) {
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bottom = M.top + plotH;
  const step = days.length > 1 ? plotW / (days.length - 1) : 0;
  const xOf = (date: DateKey) => M.left + Math.max(0, days.indexOf(date)) * step;

  const values = points.flatMap((p) => [toAxis(p.kg, unit), toAxis(p.trend, unit)]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // At least a few units of range, so small daily swings don't look dramatic.
  const minSpan = unit === "kg" ? 2 : 4;
  const pad = Math.max(0, (minSpan - (hi - lo)) / 2);
  const ticks = niceTicks(lo - pad, hi + pad, unit === "st" ? 3 : 4);
  const y = linear([ticks[0], ticks[ticks.length - 1]], [bottom, M.top]);

  const trendPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.date)},${y(toAxis(p.trend, unit))}`).join(" ");
  const labelEvery = period === "week" ? 1 : 7;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block select-none"
      role="img"
      aria-label={`Weight: ${points.length} weigh-ins with a 7-day trend line. The list below has every value.`}
      style={{ color: INK }}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={RULE} strokeWidth={1} />
          <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="currentColor" opacity={0.7} className="tabular-nums">
            {tickLabel(t, unit)}
          </text>
        </g>
      ))}

      {days.map((d, i) =>
        i % labelEvery === 0 ? (
          <text key={d} x={M.left + i * step} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.7}>
            {period === "week"
              ? fromDateKey(d).toLocaleDateString(undefined, { weekday: "short" })
              : fromDateKey(d).getDate()}
          </text>
        ) : null,
      )}

      {selected && <line x1={xOf(selected)} x2={xOf(selected)} y1={M.top} y2={bottom} stroke={TRACK} strokeWidth={8} />}

      {points.length > 1 && (
        <path d={trendPath} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {points.map((p) => (
        <circle
          key={p.date}
          cx={xOf(p.date)}
          cy={y(toAxis(p.kg, unit))}
          r={selected === p.date ? 5.5 : 4}
          fill={CHART_ON_TARGET}
          stroke={PAPER}
          strokeWidth={2}
        />
      ))}

      {/* 24px-wide hit areas centred on each weigh-in. */}
      {points.map((p) => (
        <rect
          key={`hit-${p.date}`}
          x={xOf(p.date) - 12}
          y={M.top}
          width={24}
          height={plotH}
          fill={PAPER}
          fillOpacity={0}
          onClick={() => onSelect(p.date)}
          style={{ cursor: "pointer" }}
        />
      ))}
    </svg>
  );
}
