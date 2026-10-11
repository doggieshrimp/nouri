import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import type { Food } from "../lib/nutrition";
import { BarcodeLookupError, lookupBarcode, normalizeBarcode, type BarcodeLookup } from "../lib/openFoodFacts";
import { ALERT, INK, PAPER } from "../theme";

type State = { status: "loading" } | BarcodeLookup | { status: "error"; message: string };

interface ResultProps {
  code: string;
  onFound: (food: Food) => void;
  onAddCustom: (name: string) => void;
  onClose: () => void;
}

/** Looks up a scanned or typed barcode and hands a found product to the food editor. Render with key={code}. */
export function BarcodeResult({ code, onFound, onAddCustom, onClose }: ResultProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  // Keep the latest callback without re-running the lookup when the parent re-renders.
  const onFoundRef = useRef(onFound);
  useEffect(() => {
    onFoundRef.current = onFound;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    lookupBarcode(code, ctrl.signal).then(
      (result) => {
        if (result.status === "found") onFoundRef.current(result.food);
        else setState(result);
      },
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        const message = err instanceof BarcodeLookupError ? err.message : "Something went wrong looking up that barcode.";
        setState({ status: "error", message });
      },
    );
    return () => ctrl.abort();
  }, [code]);

  return (
    <div className="border-2 p-3 mt-2 text-sm" style={{ borderColor: INK }} role="status">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-mono opacity-60 mb-1">Barcode {code}</div>
          {state.status === "loading" && (
            <div className="flex items-center gap-2 opacity-70">
              <Loader2 size={14} className="animate-spin" /> Looking up product…
            </div>
          )}
          {state.status === "not-found" && <div>No product found for this barcode.</div>}
          {state.status === "no-nutrition" && (
            <div>
              Found <strong>{state.name || "this product"}</strong>, but it has no nutrition info yet.
            </div>
          )}
          {state.status === "error" && <div style={{ color: ALERT }}>{state.message}</div>}
        </div>
        <button type="button" onClick={onClose} className="opacity-50 hover:opacity-100 p-1 -m-1" aria-label="Close barcode result">
          <X size={16} />
        </button>
      </div>
      {(state.status === "not-found" || state.status === "no-nutrition") && (
        <button
          type="button"
          onClick={() => onAddCustom(state.status === "no-nutrition" ? state.name : "")}
          className="mt-2 text-xs underline opacity-70"
        >
          Enter it from the label as a custom item
        </button>
      )}
    </div>
  );
}

interface EntryProps {
  onSubmit: (code: string) => void;
  onClose: () => void;
}

/** Type a barcode number, for the web version or a damaged label. */
export function BarcodeEntry({ onSubmit, onClose }: EntryProps) {
  const [value, setValue] = useState("");
  const code = normalizeBarcode(value);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code) onSubmit(code);
  }

  return (
    <form onSubmit={submit} className="flex gap-2 mt-2">
      <input
        autoFocus
        inputMode="numeric"
        placeholder="Barcode number"
        aria-label="Barcode number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 min-w-0 px-2 py-2 border-2 bg-transparent outline-none text-sm font-mono"
        style={{ borderColor: INK }}
      />
      <button
        type="submit"
        disabled={!code}
        className="px-3 py-2 font-bold uppercase tracking-wide text-xs disabled:opacity-40"
        style={{ background: INK, color: PAPER }}
      >
        Look up
      </button>
      <button type="button" onClick={onClose} className="opacity-50 hover:opacity-100 px-1" aria-label="Close barcode entry">
        <X size={16} />
      </button>
    </form>
  );
}
