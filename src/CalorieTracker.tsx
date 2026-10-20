import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Calculator, ChevronLeft, ChevronRight, Flame, Type } from "lucide-react";
import AboutFooter from "./components/AboutFooter";
import BackupControls from "./components/BackupControls";
import DisplaySettings from "./components/DisplaySettings";
import EntryList from "./components/EntryList";
import FoodSearch from "./components/FoodSearch";
import GoalCalculator from "./components/GoalCalculator";
import Progress from "./components/Progress";
import Segmented from "./components/Segmented";
import { DEFAULT_GOAL, getEntriesForDate, getGoal, getGoalHistory, setGoal, type LogEntry } from "./db";
import { addDays, formatDateKey, todayKey, type DateKey } from "./lib/dates";
import { goalPercent, sumMacros } from "./lib/nutrition";
import { goalOn } from "./lib/progress";
import { ALERT, GOOD, INK, PAPER, TRACK } from "./theme";

const NO_ENTRIES: LogEntry[] = [];

export default function CalorieTracker() {
  const [view, setView] = useState<"log" | "progress">("log");
  const [date, setDate] = useState<DateKey>(todayKey);
  const isToday = date === todayKey();

  const currentGoal = useLiveQuery(getGoal) ?? DEFAULT_GOAL;
  const goalHistory = useLiveQuery(getGoalHistory);
  // Past days show the goal they had; editing the goal changes it from today onwards.
  const goal = isToday ? currentGoal : goalOn(date, goalHistory ?? [], currentGoal);
  // useLiveQuery keeps returning the previous day's result until the new query
  // resolves, so tag results with their date and ignore ones for another day.
  const dayResult = useLiveQuery(
    async () => ({ date, entries: await getEntriesForDate(date) }),
    [date],
  );
  const entries = dayResult?.date === date ? dayResult.entries : NO_ENTRIES;

  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showDisplay, setShowDisplay] = useState(false);

  const totals = useMemo(() => sumMacros(entries), [entries]);
  const remaining = goal - totals.calories;
  const pctOfGoal = goalPercent(totals.calories, goal);
  const over = remaining < 0;

  function saveGoal() {
    if (goalDraft !== null) void setGoal(Math.max(0, Math.round(Number(goalDraft) || 0)));
    setGoalDraft(null);
  }

  return (
    <div
      className="min-h-full w-full flex items-start justify-center p-4 sm:p-8"
      style={{ background: PAPER, color: INK, fontFamily: "var(--font-body)" }}
    >
      <div className="w-full max-w-md">
        {/* Masthead */}
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-2xl font-black tracking-tight uppercase">Nouri</h1>
          <div className="flex items-center gap-4">
            {view === "log" && !isToday && (
              <button
                type="button"
                onClick={() => setDate(todayKey())}
                className="text-xs font-bold uppercase tracking-wide underline"
              >
                Back to today
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDisplay((v) => !v)}
              className="opacity-70 hover:opacity-100 p-1 -m-1 self-center"
              aria-label="Display and reading settings"
              aria-expanded={showDisplay}
            >
              <Type size={20} />
            </button>
          </div>
        </div>
        <div className="my-2">
          <Segmented
            label="Page"
            value={view}
            onChange={setView}
            options={[
              { value: "log", label: "Food log" },
              { value: "progress", label: "Progress" },
            ]}
          />
        </div>
        {view === "log" && (
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, -1))}
            aria-label="Previous day"
            className="opacity-70 hover:opacity-100 p-1 -ml-1"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-mono uppercase tracking-wide opacity-70">
            {isToday ? "Today · " : ""}
            {formatDateKey(date)}
          </span>
          <button
            type="button"
            onClick={() => setDate((d) => addDays(d, 1))}
            aria-label="Next day"
            disabled={isToday}
            className="opacity-70 hover:opacity-100 disabled:opacity-20 p-1 -mr-1"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        )}
        <div style={{ height: 6, background: INK }} />

        {showDisplay && <DisplaySettings onClose={() => setShowDisplay(false)} />}

        {view === "progress" ? (
          <Progress
            onOpenDay={(day) => {
              setDate(day);
              setView("log");
              window.scrollTo(0, 0);
            }}
          />
        ) : (
        <>

        {/* Nutrition-facts-style summary panel */}
        <div className="mt-3 border-2 px-4 pt-3 pb-4" style={{ borderColor: INK }}>
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: `8px solid ${INK}` }}>
            <span className="text-lg font-black uppercase tracking-tight">Calories</span>
            <span className="text-4xl font-black font-mono tabular-nums">{totals.calories}</span>
          </div>

          <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${INK}` }}>
            <span className="flex items-center gap-2">
              <button
                className="text-xs uppercase tracking-wide font-bold underline decoration-dotted"
                onClick={() => setGoalDraft((v) => (v === null ? String(goal) : v))}
              >
                Daily goal
              </button>
              <button
                type="button"
                onClick={() => setShowCalculator((v) => !v)}
                className="opacity-70 hover:opacity-100 p-1 -m-1"
                aria-label="Calculate a suggested goal"
                aria-expanded={showCalculator}
              >
                <Calculator size={14} />
              </button>
            </span>
            {goalDraft !== null ? (
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                aria-label="Daily calorie goal"
                value={goalDraft}
                onChange={(ev) => setGoalDraft(ev.target.value)}
                onBlur={saveGoal}
                onKeyDown={(ev) => ev.key === "Enter" && saveGoal()}
                className="w-24 text-right font-mono font-bold bg-transparent border-b outline-none"
                style={{ borderColor: INK }}
              />
            ) : (
              <span className="font-mono font-bold">{goal}</span>
            )}
          </div>

          <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${INK}` }}>
            <span className="text-xs uppercase tracking-wide font-bold flex items-center gap-1">
              <Flame size={14} /> {over ? "Over goal" : "Remaining"}
            </span>
            <span className="font-mono font-bold text-lg" style={{ color: over ? ALERT : GOOD }}>
              {over ? `+${Math.abs(remaining)}` : remaining}
            </span>
          </div>

          <div className="mt-3 h-2 w-full" style={{ background: TRACK }}>
            <div
              className="h-2"
              style={{ width: `${pctOfGoal}%`, background: over ? ALERT : INK, transition: "width 300ms ease" }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3" style={{ borderTop: `8px solid ${INK}` }}>
            {[
              { label: "Protein", value: totals.protein },
              { label: "Carbs", value: totals.carbs, sub: { label: "of which sugars", value: totals.sugars, partial: totals.sugarsIncomplete } },
              { label: "Fat", value: totals.fat, sub: { label: "of which saturates", value: totals.saturatedFat, partial: totals.saturatedFatIncomplete } },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-xs uppercase tracking-wide opacity-70">{m.label}</div>
                <div className="font-mono font-bold text-lg">{m.value}g</div>
                {m.sub && (
                  <div className="mt-1">
                    <div className="text-[0.6875rem] opacity-70">{m.sub.label}</div>
                    <div className="font-mono text-sm">
                      {m.sub.value}g{m.sub.partial && entries.length > 0 && <span aria-hidden>*</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {(totals.sugarsIncomplete || totals.saturatedFatIncomplete) && entries.length > 0 && (
            <p className="text-[0.6875rem] opacity-70 mt-2 text-center">
              * Some foods today don&rsquo;t list this, so the real amount may be higher.
            </p>
          )}
        </div>

        {showCalculator && (
          <GoalCalculator
            onUse={(suggested) => {
              void setGoal(suggested);
              setShowCalculator(false);
            }}
            onClose={() => setShowCalculator(false)}
          />
        )}

        <FoodSearch date={date} />
        <EntryList entries={entries} isToday={isToday} />
        </>
        )}
        <BackupControls />
        <AboutFooter />
      </div>
    </div>
  );
}
