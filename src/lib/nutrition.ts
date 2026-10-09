export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** A food's nutrition values per 100g. */
export interface Food extends Macros {
  name: string;
}

export interface Entry extends Macros {
  id: string;
  name: string;
}

export const EMPTY_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/** Rounds to one decimal place, avoiding float artifacts like 33.700000000000003. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Scales a per-100g food to the given weight in grams. */
export function scaleFood(food: Food, grams: number): Macros {
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fat: round1(food.fat * factor),
  };
}

export function sumMacros(items: Macros[]): Macros {
  const raw = items.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    EMPTY_MACROS,
  );
  return {
    calories: Math.round(raw.calories),
    protein: round1(raw.protein),
    carbs: round1(raw.carbs),
    fat: round1(raw.fat),
  };
}

/** Percent of the calorie goal eaten, clamped to 0–100. A goal of 0 or less yields 0. */
export function goalPercent(calories: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((calories / goal) * 100)));
}
