import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUp, Check, ChevronLeft, ChevronRight, Clock, Minus, Trash2 } from "lucide-react";
import {
  DEFAULT_GOAL,
  deleteWeight,
  getCaloriesByDay,
  getGoal,
  getGoalHistory,
  getWeighIns,
  setWeight,
} from "../db";
import { addDays, fromDateKey, todayKey, type DateKey } from "../lib/dates";
import {
  dayResults,
  formatWeight,
  formatWeightChange,
  lbToKg,
  periodLabel,
  periodRange,
  shiftPeriod,
  summarizeCalories,
  trendChange,
  WEIGHT_LIMITS_KG,
  withTrend,
  type DayResult,
  type Period,
  type WeightUnit,
} from "../lib/progress";
import { ALERT, CHART_ON_TARGET, CHART_OVER, GOLD, INK, PAPER, RULE } from "../theme";
import CalorieChart from "./CalorieChart";
import Segmented from "./Segmented";
import WeightChart from "./WeightChart";

const UNIT_KEY = "daily-log:weight-unit";

function loadUnit(): WeightUnit {
  try {
    const v = localStorage.getItem(UNIT_KEY);
    return v === "lb" || v === "st" ? v : "kg";
  } catch {
    return "kg";
  }
}

function dayName(date: DateKey): string {
  return fromDateKey(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const kcal = (n: number) => n.toLocaleString();

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-2 p-3" style={{ borderColor: INK }}>
      <h2 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: GOLD }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-2 p-2 text-center" style={{ borderColor: INK }}>
      <div className="text-[0.6875rem] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-black my-0.5">{value}</div>
      <div className="text-[0.6875rem] opacity-70 leading-tight">{detail}</div>
    </div>
  );
}

/** Status shown as an icon and words, never colour alone. */
function StatusText({ day }: { day: DayResult }) {
  if (day.status === "on-target")
    return (
      <span className="flex items-center gap-1">
        <Check size={14} color={CHART_ON_TARGET} aria-hidden /> On target
      </span>
    );
  if (day.status === "today")
    return (
      <span className="flex items-center gap-1">
        <Clock size={14} aria-hidden />{" "}
        {day.calories === null
          ? "Nothing yet today"
          : day.calories > day.goal
            ? `So far today · ${kcal(day.calories - day.goal)} over`
            : `So far today · ${kcal(day.goal - day.calories)} left`}
      </span>
    );
  if (day.status === "over")
    return (
      <span className="flex items-center gap-1">
        <ArrowUp size={14} color={CHART_OVER} aria-hidden /> {kcal(day.calories! - day.goal)} over
      </span>
    );
  return (
    <span className="flex items-center gap-1 opacity-70">
      <Minus size={14} aria-hidden /> {day.status === "future" ? "Still to come" : "Not logged"}
    </span>
  );
}

function LegendKey({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
}

interface Props {
  /** Opens a day in the food log. */
  onOpenDay: (date: DateKey) => void;
}

export default function Progress({ onOpenDay }: Props) {
  const today = todayKey();
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState<DateKey>(today);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedWeigh, setSelectedWeigh] = useState<DateKey | null>(null);
  const [unit, setUnitState] = useState<WeightUnit>(loadUnit);

  const range = useMemo(() => periodRange(period, anchor), [period, anchor]);
  const isCurrent = range.start <= today && today <= range.end;

  const goal = useLiveQuery(getGoal) ?? DEFAULT_GOAL;
  const history = useLiveQuery(getGoalHistory);
  const caloriesByDay = useLiveQuery(() => getCaloriesByDay(range.start, range.end), [range.start, range.end]);
  // Six days before the period too, so the first trend points have a full week behind them.
  const weighIns = useLiveQuery(() => getWeighIns(addDays(range.start, -6), range.end), [range.start, range.end]);
  const todayWeight = useLiveQuery(() => getWeighIns(today, today), [today])?.[0];

  const days = useMemo(
    () => dayResults(range.days, caloriesByDay ?? new Map(), history ?? [], goal, today),
    [range.days, caloriesByDay, history, goal, today],
  );
  const summary = summarizeCalories(days);
  const trendPoints = useMemo(
    () => withTrend(weighIns ?? []).filter((p) => p.date >= range.start && p.date <= range.end),
    [weighIns, range.start, range.end],
  );
  const change = trendChange(trendPoints);

  function changePeriod(next: Period) {
    setPeriod(next);
    setSelectedDay(null);
    setSelectedWeigh(null);
  }

  function shift(direction: -1 | 1) {
    setAnchor((a) => shiftPeriod(period, a, direction));
    setSelectedDay(null);
    setSelectedWeigh(null);
  }

  function setUnit(next: WeightUnit) {
    setUnitState(next);
    try {
      localStorage.setItem(UNIT_KEY, next);
    } catch {
      // Not saved; the choice still applies for now.
    }
  }

  const selected = selectedDay !== null ? days[selectedDay] : null;
  const selectedPoint = trendPoints.find((p) => p.date === selectedWeigh) ?? null;

  return (
    <div className="mt-3">
      {/* One filter row scopes everything below it. */}
      <div className="flex items-center gap-2">
        <div className="w-36 shrink-0">
          <Segmented
            label="Period"
            value={period}
            onChange={changePeriod}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        </div>
        <div className="flex-1 flex items-center justify-between min-w-0">
          <button type="button" onClick={() => shift(-1)} aria-label={`Previous ${period}`} className="p-1 opacity-70 hover:opacity-100">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-center truncate">{periodLabel(period, range)}</span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={`Next ${period}`}
            disabled={isCurrent}
            className="p-1 opacity-70 hover:opacity-100 disabled:opacity-20"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <Tile
          label="On target"
          value={summary.loggedDays ? `${summary.onTargetDays} of ${summary.loggedDays}` : "–"}
          detail={summary.loggedDays === 1 ? "day logged" : "days logged"}
        />
        <Tile
          label="Average"
          value={summary.averageCalories !== null ? kcal(summary.averageCalories) : "–"}
          detail={summary.averageGoal !== null ? `kcal a day · goal ${kcal(summary.averageGoal)}` : "kcal a day"}
        />
        <Tile
          label="Weight"
          value={change !== null ? formatWeightChange(change, unit) : "–"}
          detail={change !== null ? "7-day trend" : "log 2+ weigh-ins"}
        />
      </div>

      <Card title="Calories each day">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-1">
          <LegendKey swatch={<span className="w-3 h-3 rounded-sm" style={{ background: CHART_ON_TARGET }} />} label="On target" />
          <LegendKey
            swatch={<span className="w-3 h-3 rounded-sm" style={{ background: CHART_OVER }} />}
            label={period === "week" ? "Over goal ▲" : "Over goal"}
          />
          {isCurrent && (
            <LegendKey
              swatch={<span className="w-3 h-3 rounded-sm" style={{ background: CHART_ON_TARGET, opacity: 0.45 }} />}
              label="Today so far"
            />
          )}
          <LegendKey swatch={<span className="w-4 h-0.5" style={{ background: INK }} />} label="Goal" />
        </div>
        <CalorieChart period={period} days={days} selected={selectedDay} onSelect={setSelectedDay} />

        <div className="mt-2 min-h-12 text-sm" role="status">
          {selected ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold">
                  {dayName(selected.date)} · {selected.calories !== null ? `${kcal(selected.calories)} kcal` : "nothing logged"}
                </div>
                <div className="text-xs opacity-70 flex gap-1">
                  <StatusText day={selected} /> <span>· goal {kcal(selected.goal)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenDay(selected.date)}
                className="shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                style={{ background: INK, color: PAPER }}
              >
                Open day
              </button>
            </div>
          ) : (
            <p className="text-xs opacity-70">Tap a day for its details.</p>
          )}
        </div>

        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs underline opacity-70">Day by day</summary>
          <ul className="mt-1">
            {days.map((d) => (
              <li key={d.date} style={{ borderBottom: `1px solid ${RULE}` }}>
                <button
                  type="button"
                  disabled={d.status === "future"}
                  onClick={() => onOpenDay(d.date)}
                  className="w-full flex items-center justify-between gap-2 py-1.5 text-left disabled:opacity-50"
                >
                  <span className="w-24 shrink-0">{dayName(d.date)}</span>
                  <span className="font-mono tabular-nums w-16 text-right">{d.calories !== null ? kcal(d.calories) : "–"}</span>
                  <span className="flex-1 flex justify-end text-xs">
                    <StatusText day={d} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card title="Weight">
        <WeightForm unit={unit} onUnitChange={setUnit} todayKg={todayWeight?.kg} />

        {trendPoints.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-3 mb-1">
              <LegendKey
                swatch={<span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_ON_TARGET }} />}
                label="Weigh-in"
              />
              <LegendKey swatch={<span className="w-4 h-0.5" style={{ background: INK }} />} label="7-day trend" />
            </div>
            <WeightChart
              period={period}
              days={range.days}
              points={trendPoints}
              unit={unit}
              selected={selectedWeigh}
              onSelect={setSelectedWeigh}
            />
            <div className="mt-2 min-h-10 text-sm" role="status">
              {selectedPoint ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">
                      {dayName(selectedPoint.date)} · {formatWeight(selectedPoint.kg, unit)}
                    </div>
                    <div className="text-xs opacity-70">7-day trend {formatWeight(selectedPoint.trend, unit)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete the weigh-in for ${dayName(selectedPoint.date)}?`)) {
                        void deleteWeight(selectedPoint.date);
                        setSelectedWeigh(null);
                      }
                    }}
                    className="shrink-0 p-2 opacity-70 hover:opacity-100"
                    aria-label={`Delete weigh-in for ${dayName(selectedPoint.date)}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <p className="text-xs opacity-70">Tap a dot for its details.</p>
              )}
            </div>
            <details className="mt-1 text-sm">
              <summary className="cursor-pointer text-xs underline opacity-70">All weigh-ins</summary>
              <ul className="mt-1">
                {[...trendPoints].reverse().map((p) => (
                  <li key={p.date} className="flex items-center justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${RULE}` }}>
                    <span className="w-24 shrink-0">{dayName(p.date)}</span>
                    <span className="font-mono tabular-nums">{formatWeight(p.kg, unit)}</span>
                    <span className="text-xs opacity-70">trend {formatWeight(p.trend, unit)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : (
          <p className="text-xs opacity-70 mt-3">
            No weigh-ins {isCurrent ? `this ${period}` : `in this ${period}`} yet. Weighing in at the same time each day, like
            first thing in the morning, gives the steadiest trend.
          </p>
        )}
      </Card>
    </div>
  );
}

function WeightForm({ unit, onUnitChange, todayKg }: { unit: WeightUnit; onUnitChange: (u: WeightUnit) => void; todayKg?: number }) {
  const [main, setMain] = useState("");
  const [pounds, setPounds] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toKg(): number | null {
    const a = Number(main);
    const b = Number(pounds || 0);
    if (!main.trim() || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (unit === "kg") return a;
    if (unit === "lb") return lbToKg(a);
    return lbToKg(a * 14 + b);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const kg = toKg();
    if (kg === null || kg < WEIGHT_LIMITS_KG.min || kg > WEIGHT_LIMITS_KG.max) {
      setError("Enter a realistic weight.");
      return;
    }
    await setWeight(todayKey(), kg);
    setMain("");
    setPounds("");
    setError(null);
  }

  const inputClass = "w-full min-w-0 px-2 py-2 border-2 bg-transparent outline-none text-sm font-mono";

  return (
    <form onSubmit={submit}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs opacity-70">
          {todayKg !== undefined ? `Today: ${formatWeight(todayKg, unit)}` : "Not weighed in today"}
        </span>
        <div className="w-36">
          <Segmented
            label="Weight unit"
            value={unit}
            onChange={(u) => {
              onUnitChange(u);
              setMain("");
              setPounds("");
            }}
            options={[
              { value: "kg", label: "kg" },
              { value: "lb", label: "lb" },
              { value: "st", label: "st", ariaLabel: "stone and pounds" },
            ]}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type="number"
            inputMode="decimal"
            aria-label={unit === "st" ? "Weight, stone" : `Weight in ${unit === "kg" ? "kilograms" : "pounds"}`}
            placeholder={unit === "st" ? "st" : unit}
            value={main}
            onChange={(e) => setMain(e.target.value)}
            className={inputClass}
            style={{ borderColor: INK }}
          />
          <span className="text-xs opacity-70 shrink-0">{unit}</span>
        </label>
        {unit === "st" && (
          <label className="flex items-center gap-1 flex-1 min-w-0">
            <input
              type="number"
              inputMode="decimal"
              aria-label="Weight, pounds"
              placeholder="lb"
              value={pounds}
              onChange={(e) => setPounds(e.target.value)}
              className={inputClass}
              style={{ borderColor: INK }}
            />
            <span className="text-xs opacity-70 shrink-0">lb</span>
          </label>
        )}
        <button
          type="submit"
          className="shrink-0 px-3 py-2 font-bold uppercase tracking-wide text-xs"
          style={{ background: INK, color: PAPER }}
        >
          {todayKg !== undefined ? "Update" : "Save"}
        </button>
      </div>
      {error && (
        <p className="text-xs mt-1" role="alert" style={{ color: ALERT }}>
          {error}
        </p>
      )}
    </form>
  );
}
