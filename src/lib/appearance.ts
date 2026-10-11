import { Capacitor, registerPlugin } from "@capacitor/core";

// Reading-comfort settings, following the British Dyslexia Association style guide:
// tinted backgrounds, clear sans-serif fonts, larger text, extra spacing, and
// avoiding capitals and italics. Stored per device; they're not personal data.

export const BACKGROUNDS = {
  cream: { label: "Cream", paper: "#FAF8F3", dark: false },
  yellow: { label: "Soft yellow", paper: "#FBF3D0", dark: false },
  blue: { label: "Pale blue", paper: "#E4EEF8", dark: false },
  mint: { label: "Mint", paper: "#E3F2E6", dark: false },
  peach: { label: "Peach", paper: "#FBE8DC", dark: false },
  dark: { label: "Dark", paper: "#1C1C1A", dark: true },
} as const;
export type Background = keyof typeof BACKGROUNDS;

export const FONTS = {
  opensans: { label: "Open Sans (default)", stack: "'Open Sans Variable', ui-sans-serif, system-ui, sans-serif" },
  lexend: { label: "Lexend", stack: "'Lexend Variable', ui-sans-serif, sans-serif" },
  atkinson: { label: "Atkinson Hyperlegible", stack: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, sans-serif" },
  opendyslexic: { label: "OpenDyslexic", stack: "'OpenDyslexic', ui-sans-serif, sans-serif" },
} as const;
export type Font = keyof typeof FONTS;

export const TEXT_SIZES = [
  { value: 1, label: "A" },
  { value: 1.125, label: "A+" },
  { value: 1.25, label: "A++" },
  { value: 1.5, label: "A+++" },
] as const;

export interface Appearance {
  background: Background;
  font: Font;
  textSize: number;
  extraSpacing: boolean;
  /** Turn off ALL CAPS labels and italics. */
  plainText: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  background: "cream",
  font: "opensans",
  textSize: 1,
  extraSpacing: false,
  plainText: false,
};

const STORAGE_KEY = "daily-log:appearance";

/** Colour tokens per background. All text colours meet WCAG AA (4.5:1) on their paper. */
function tokens(background: Background) {
  const { paper, dark } = BACKGROUNDS[background];
  return dark
    ? { paper, ink: "#EEEAE2", gold: "#D9B77E", alert: "#FF8F66", good: "#93CC98", rule: "#3A3936", track: "#33322F" }
    : { paper, ink: "#1A1A1A", gold: "#7A5C2E", alert: "#A8380A", good: "#3B6A40", rule: "#DDD6C4", track: "#E7E2D6" };
}

function isValid(a: unknown): a is Appearance {
  if (typeof a !== "object" || a === null) return false;
  const r = a as Record<string, unknown>;
  return (
    typeof r.background === "string" &&
    r.background in BACKGROUNDS &&
    typeof r.font === "string" &&
    r.font in FONTS &&
    TEXT_SIZES.some((s) => s.value === r.textSize) &&
    typeof r.extraSpacing === "boolean" &&
    typeof r.plainText === "boolean"
  );
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isValid(parsed) ? parsed : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(a: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    // Storage unavailable (e.g. private browsing): settings still apply for this session.
  }
}

// Native side (MainActivity's AppThemePlugin): colours the area behind the system bars
// and picks light or dark bar icons to match.
const AppTheme = registerPlugin<{ setColors(options: { background: string; darkIcons: boolean }): Promise<void> }>(
  "AppTheme",
);

export function applyAppearance(a: Appearance, root: HTMLElement = document.documentElement): void {
  const t = tokens(a.background);
  for (const [name, value] of Object.entries(t)) root.style.setProperty(`--${name}`, value);
  root.style.setProperty("--font-body", FONTS[a.font].stack);
  root.style.fontSize = `${a.textSize * 100}%`;
  root.style.colorScheme = BACKGROUNDS[a.background].dark ? "dark" : "light";
  root.dataset.font = a.font;
  root.classList.toggle("extra-spacing", a.extraSpacing);
  root.classList.toggle("plain-text", a.plainText);

  if (Capacitor.isNativePlatform()) {
    AppTheme.setColors({ background: t.paper, darkIcons: !BACKGROUNDS[a.background].dark }).catch(() => {});
  }
}
