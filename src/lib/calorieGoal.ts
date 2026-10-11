// Suggested daily calorie goal from the Mifflin-St Jeor equation, the most widely used
// estimate of resting energy needs for adults.

export type Sex = "male" | "female" | "unspecified";

export const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary", detail: "Desk job, little or no exercise", factor: 1.2 },
  { id: "light", label: "Lightly active", detail: "Exercise 1–3 days a week", factor: 1.375 },
  { id: "moderate", label: "Moderately active", detail: "Exercise 3–5 days a week", factor: 1.55 },
  { id: "active", label: "Very active", detail: "Hard exercise 6–7 days a week", factor: 1.725 },
  { id: "extra", label: "Extra active", detail: "Physical job or training twice a day", factor: 1.9 },
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]["id"];

// ~7700 kcal per kg of body fat, so 0.5 kg/week is about 550 kcal/day.
export const RATES = [
  { id: "lose-fast", label: "Lose 0.75 kg (1.5 lb) a week", dailyChange: -825 },
  { id: "lose", label: "Lose 0.5 kg (1 lb) a week", dailyChange: -550 },
  { id: "lose-slow", label: "Lose 0.25 kg (0.5 lb) a week", dailyChange: -275 },
  { id: "maintain", label: "Maintain weight", dailyChange: 0 },
  { id: "gain-slow", label: "Gain 0.25 kg (0.5 lb) a week", dailyChange: 275 },
] as const;
export type Rate = (typeof RATES)[number]["id"];

/** Commonly cited minimums for unsupervised dieting. */
const FLOOR: Record<Sex, number> = { male: 1500, female: 1200, unspecified: 1200 };
/** Mifflin-St Jeor sex constants; "unspecified" uses the midpoint. */
const SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161, unspecified: -78 };

export const LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 300 },
};

export interface GoalInputs {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  rate: Rate;
}

export interface GoalSuggestion {
  bmr: number;
  maintenance: number;
  goal: number;
  /** True when the goal was raised to the safe minimum. */
  raisedToFloor: boolean;
}

export function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

/** Resting calories burned per day. */
export function bmr({ sex, age, heightCm, weightKg }: Pick<GoalInputs, "sex" | "age" | "heightCm" | "weightKg">): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANT[sex];
}

const roundTo10 = (n: number) => Math.round(n / 10) * 10;

/** Returns a message for the first input out of range, or null if all are usable. */
export function validateInputs(inputs: Pick<GoalInputs, "age" | "heightCm" | "weightKg">): string | null {
  const { age, heightCm, weightKg } = inputs;
  if (!(age >= LIMITS.age.min && age <= LIMITS.age.max)) {
    return age > 0 && age < LIMITS.age.min
      ? "This formula is for adults. For under-18s, ask a doctor about calorie needs."
      : `Enter an age between ${LIMITS.age.min} and ${LIMITS.age.max}.`;
  }
  if (!(heightCm >= LIMITS.heightCm.min && heightCm <= LIMITS.heightCm.max)) return "Enter a realistic height.";
  if (!(weightKg >= LIMITS.weightKg.min && weightKg <= LIMITS.weightKg.max)) return "Enter a realistic weight.";
  return null;
}

export function suggestGoal(inputs: GoalInputs): GoalSuggestion {
  const resting = bmr(inputs);
  const factor = ACTIVITY_LEVELS.find((a) => a.id === inputs.activity)!.factor;
  const change = RATES.find((r) => r.id === inputs.rate)!.dailyChange;
  const maintenance = resting * factor;
  const target = maintenance + change;
  const floor = FLOOR[inputs.sex];
  const raisedToFloor = change < 0 && target < floor;
  return {
    bmr: roundTo10(resting),
    maintenance: roundTo10(maintenance),
    goal: roundTo10(raisedToFloor ? floor : target),
    raisedToFloor,
  };
}
