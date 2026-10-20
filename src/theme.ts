// ---- Design tokens ----
// CSS variables set by applyAppearance() in lib/appearance.ts, so the reader's chosen
// background (cream by default, or a tint/dark mode) recolours everything.

export const INK = "var(--ink)";
export const PAPER = "var(--paper)";
export const ALERT = "var(--alert)";
export const GOOD = "var(--good)";
export const GOLD = "var(--gold)";
export const RULE = "var(--rule)";
export const TRACK = "var(--track)";

// Chart fills, chosen with the dataviz palette validator: this blue/red pair stays
// distinguishable with red-green colour blindness (ΔE 23.8) and clears 3:1 contrast on
// every background in lib/appearance.ts, light and dark. Text never uses these.
export const CHART_ON_TARGET = "#2a78d6";
export const CHART_OVER = "#d03b3b";
