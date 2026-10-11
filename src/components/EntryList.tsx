import { useState, type FormEvent } from "react";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { deleteEntry, saveMeal, type LogEntry } from "../db";
import { sumMacros } from "../lib/nutrition";
import { GOLD, INK, PAPER, RULE } from "../theme";

interface Props {
  entries: LogEntry[];
  isToday: boolean;
}

export default function EntryList({ entries, isToday }: Props) {
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>
          {isToday ? "Today’s entries" : "Entries"}
        </div>
        {entries.length > 0 && !saving && (
          <button type="button" onClick={() => setSaving(true)} className="text-xs underline opacity-70 flex items-center gap-1">
            <BookmarkPlus size={14} /> Save as meal
          </button>
        )}
      </div>

      {saving && <SaveMealPanel entries={entries} onDone={() => setSaving(false)} />}

      {entries.length === 0 && (
        <div className="text-sm opacity-60 italic py-4 text-center">
          {isToday ? "Nothing logged yet. Add your first item above." : "Nothing logged this day."}
        </div>
      )}
      <ul>
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: `1px solid ${RULE}` }}>
            <div className="min-w-0">
              <div className="text-sm font-medium">{e.name}</div>
              <div className="text-xs font-mono opacity-60">
                P{e.protein} · C{e.carbs} · F{e.fat}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono font-bold text-sm">{e.calories}</span>
              <button onClick={() => deleteEntry(e.id)} aria-label={`Remove ${e.name}`} className="opacity-50 hover:opacity-100 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveMealPanel({ entries, onDone }: { entries: LogEntry[]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(entries.map((e) => e.id)));
  const chosen = entries.filter((e) => picked.has(e.id));

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || chosen.length === 0) return;
    await saveMeal(name.trim(), chosen);
    onDone();
  }

  return (
    <form onSubmit={submit} className="border-2 p-3 mb-3" style={{ borderColor: INK }}>
      <input
        autoFocus
        placeholder="Meal name, e.g. Usual breakfast"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-2 py-2 border-2 bg-transparent outline-none text-sm mb-2"
        style={{ borderColor: INK }}
      />
      <ul className="mb-3">
        {entries.map((e) => (
          <li key={e.id}>
            <label className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} className="accent-black" />
              <span className="flex-1 min-w-0 truncate">{e.name}</span>
              <span className="text-xs font-mono opacity-60">{e.calories}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim() || chosen.length === 0}
          className="flex-1 py-2 font-bold uppercase tracking-wide text-xs disabled:opacity-40"
          style={{ background: INK, color: PAPER }}
        >
          Save {chosen.length} items · {sumMacros(chosen).calories} kcal
        </button>
        <button type="button" onClick={onDone} className="px-3 py-2 text-xs underline opacity-70">
          Cancel
        </button>
      </div>
    </form>
  );
}
