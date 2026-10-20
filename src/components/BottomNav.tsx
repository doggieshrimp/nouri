import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChartColumn, NotebookPen } from "lucide-react";
import { INK, PAPER } from "../theme";

export type Page = "log" | "track";

const PAGES: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "log", label: "Log", icon: NotebookPen },
  { id: "track", label: "Track", icon: ChartColumn },
];

/** Height of the bar, so the page can leave room for it. */
export const BOTTOM_NAV_HEIGHT = 64;

/** Page switcher fixed to the bottom of the screen, within thumb reach. Icons always have labels. */
function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement || el.isContentEditable) return true;
  return el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file"].includes(el.type);
}

/**
 * True while a text field has focus, i.e. while the on-screen keyboard is up. The bar
 * hides then, so it doesn't sit on top of the keyboard and cover search results.
 */
function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => setTyping(isTextField(e.target));
    const onFocusOut = (e: FocusEvent) => setTyping(isTextField(e.relatedTarget));
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return typing;
}

export default function BottomNav({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  const typing = useTyping();
  if (typing) return null;
  return (
    <nav
      aria-label="Pages"
      className="fixed inset-x-0 bottom-0 z-10 flex justify-center"
      style={{
        background: PAPER,
        borderTop: `2px solid ${INK}`,
        // Clear the home indicator in browsers; the Android app already pads around system bars.
        paddingBottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="w-full max-w-md flex gap-2 px-4 py-2" style={{ height: BOTTOM_NAV_HEIGHT }}>
        {PAGES.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-bold uppercase tracking-wide"
              style={{ background: active ? INK : "transparent", color: active ? PAPER : INK }}
            >
              <Icon size={20} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
