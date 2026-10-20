import { fromDateKey } from "../lib/dates";
import type { DayResult, Period } from "../lib/progress";
import { linear, niceTicks } from "../lib/scale";
import { CHART_ON_TARGET, CHART_OVER, INK, PAPER, RULE, TRACK } from "../theme";

interface Props {
  period: Period;
  days: DayResult[];
  selected: number | null;
  onSelect: (index: number) => void;
}

const W = 340;
const H = 200;
const M = { top: 14, right: 6, bottom: 24, left: 40 };
const MAX_BAR = 24;

/** A column with a rounded top and a square base, as a path. */
function columnPath(x: number, y: number, width: number, bottom: number): string {
  const r = Math.min(4, width / 2, bottom - y);
  return `M${x},${bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${bottom} Z`;
}

function xLabel(period: Period, date: string, index: number): string | null {
  const d = fromDateKey(date);
  if (period === "week") return d.toLocaleDateString(undefined, { weekday: "short" });
  // Month: label the 1st and every 7 days after, so labels never collide.
  return index % 7 === 0 ? String(d.getDate()) : null;
}

/** Daily calories as columns against the goal, coloured by whether the day was on target. */
export default function CalorieChart({ period, days, selected, onSelect }: Props) {
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bottom = M.top + plotH;
  const band = plotW / days.length;
  const barW = Math.max(3, Math.min(MAX_BAR, band - 2));

  const highest = Math.max(1, ...days.map((d) => Math.max(d.goal, d.calories ?? 0)));
  const ticks = niceTicks(0, highest * 1.08, 4);
  const y = linear([0, ticks[ticks.length - 1]], [bottom, M.top]);
  const bandX = (i: number) => M.left + i * band;

  // The goal can change mid-period, so draw it as a step line across the bands.
  const goalPath = days
    .map((d, i) => `${i === 0 ? "M" : "L"}${bandX(i)},${y(d.goal)} H${bandX(i + 1)}`)
    .join(" ");

  const over = days.filter((d) => d.status === "over").length;
  const onTarget = days.filter((d) => d.status === "on-target").length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block select-none"
      role="img"
      aria-label={`Calories each day: ${onTarget} on target, ${over} over goal. The day-by-day list below has every value.`}
      style={{ color: INK }}
    >
      {/* Gridlines and y-axis labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={RULE} strokeWidth={1} />
          <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="currentColor" opacity={0.7} className="tabular-nums">
            {t >= 1000 ? `${t / 1000}k` : t}
          </text>
        </g>
      ))}

      {days.map((d, i) => {
        const cx = bandX(i) + band / 2;
        const isSelected = selected === i;
        const label = xLabel(period, d.date, i);
        return (
          <g key={d.date}>
            {isSelected && <rect x={bandX(i)} y={M.top} width={band} height={plotH} fill={TRACK} />}
            {d.calories !== null && d.calories > 0 && (
              <path
                d={columnPath(cx - barW / 2, y(d.calories), barW, bottom)}
                fill={d.calories > d.goal ? CHART_OVER : CHART_ON_TARGET}
                // Today is still in progress, so it's drawn lighter.
                fillOpacity={d.status === "today" ? 0.45 : 1}
              />
            )}
            {d.calories !== null && d.calories > d.goal && period === "week" && (
              <text x={cx} y={y(d.calories) - 4} textAnchor="middle" fontSize={9} fill="currentColor" aria-hidden>
                ▲
              </text>
            )}
            {d.status === "not-logged" && (
              <circle cx={cx} cy={bottom - 4} r={2.5} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.5} />
            )}
            {label && (
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" opacity={isSelected ? 1 : 0.7} fontWeight={isSelected ? 700 : 400}>
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Goal line sits above the columns so it's never hidden. */}
      <path d={goalPath} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <line x1={M.left} x2={W - M.right} y1={bottom} y2={bottom} stroke="currentColor" strokeOpacity={0.5} strokeWidth={1} />

      {/* Whole-height hit areas: tap anywhere in a day's band. */}
      {days.map((d, i) =>
        d.status === "future" ? null : (
          <rect
            key={`hit-${d.date}`}
            x={bandX(i)}
            y={M.top}
            width={band}
            height={plotH + M.bottom}
            fill={PAPER}
            fillOpacity={0}
            onClick={() => onSelect(i)}
            style={{ cursor: "pointer" }}
          />
        ),
      )}
    </svg>
  );
}
