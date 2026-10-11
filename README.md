# Nouri

A free, ad-free calorie and macro tracker, styled after a nutrition-facts label.

## Features

- Daily calorie goal with remaining/over indicator and progress bar
- Goal calculator (Mifflin-St Jeor) from height, weight, age, sex and activity, with a safe minimum; the inputs are never stored, only the chosen goal
- Protein, carbs and fat totals
- Food search across USDA FoodData Central (generic and branded foods), with label serving sizes
- Recent foods and saved meals for one-tap logging
- Display and reading settings for dyslexic readers (following the British Dyslexia Association style guide): tinted or dark backgrounds, Open Sans, Lexend, Atkinson Hyperlegible or OpenDyslexic, larger text, extra spacing, and a no-capitals/no-italics mode; all text colours meet WCAG AA contrast
- Privacy policy built in, plus an in-app feedback button for testers (Google Forms)
- Barcode scanning on Android (Google's ML Kit code scanner, no camera permission needed), with product data from Open Food Facts; barcodes can also be typed in
- Custom food entries
- Saved on the device (IndexedDB), with day-by-day history
- Backup export and import as JSON

## Tech

- React 19 + TypeScript, built with Vite
- Tailwind CSS
- Dexie (IndexedDB) for offline, on-device storage
- Vitest for unit tests on the nutrition math
- Capacitor for the Android app

## Getting started

```bash
npm install
npm run dev
```

Food search uses the USDA FoodData Central API. Get a free key at
https://fdc.nal.usda.gov/api-key-signup, copy `.env.example` to `.env.local`,
and set `VITE_USDA_API_KEY`. Without it, development falls back to USDA's
heavily rate-limited `DEMO_KEY`, and production builds disable online search.

Other scripts: `npm test`, `npm run lint`, `npm run build`.

## Android app

Requires Android Studio (its bundled Java and SDK are used automatically).

```bash
npm run apk
```

This builds the web app, syncs it into the Capacitor Android project, and writes a
debug APK to `release/Nouri.apk`. To open the native project in Android Studio,
run `npx cap open android`.

### Before a public release

- Replace `CHANGE-ME@example.com` in `src/config.ts` and `public/privacy.html` with the
  contact email. `npm run aab` refuses to build until you do.
- For tester feedback, paste a pre-filled Google Form link into `FEEDBACK_FORM_URL` in
  `src/config.ts` (instructions in the file). The app fills in its version and the
  phone model unless the tester opts out.
- The privacy policy is `public/privacy.html`. It ships inside the app and is published
  alongside the web build (e.g. GitHub Pages) for the Play Console's privacy policy link.

### Google Play releases

1. One time: `npm run create-key` creates the upload key in `keys/` and writes
   `android/keystore.properties`. Both are gitignored; back them up.
2. Bump the version with `npm version patch` (or `minor`/`major`). The Android
   versionCode is derived from it.
3. `npm run aab` writes a signed bundle to `release/Nouri-<version>.aab`
   for upload to the Play Console.

## Roadmap

- [x] Project setup, TypeScript, tests
- [x] Save data on the device, with day-by-day history and backup export/import
- [x] USDA FoodData Central search, recent foods, saved meals
- [x] Android app (Capacitor), Google Play release setup
- [x] Barcode scanning
- [ ] Weight tracking with a trend line, weekly charts
