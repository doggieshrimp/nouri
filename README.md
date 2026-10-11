# Daily Log

A free, ad-free calorie and macro tracker, styled after a nutrition-facts label.

## Features

- Daily calorie goal with remaining/over indicator and progress bar
- Protein, carbs and fat totals
- Ingredient lookup with per-gram scaling
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

Other scripts: `npm test`, `npm run lint`, `npm run build`.

## Android app

Requires Android Studio (its bundled Java and SDK are used automatically).

```bash
npm run apk
```

This builds the web app, syncs it into the Capacitor Android project, and writes a
debug APK to `release/DailyLog.apk`. To open the native project in Android Studio,
run `npx cap open android`.

### Google Play releases

1. One time: `npm run create-key` creates the upload key in `keys/` and writes
   `android/keystore.properties`. Both are gitignored; back them up.
2. Bump the version with `npm version patch` (or `minor`/`major`). The Android
   versionCode is derived from it.
3. `npm run aab` writes a signed bundle to `release/DailyLog-<version>.aab`
   for upload to the Play Console.

## Roadmap

- [x] Project setup, TypeScript, tests
- [x] Save data on the device, with day-by-day history and backup export/import
- [ ] USDA FoodData Central search, recent foods, saved meals
- [ ] Weight tracking with a trend line, weekly charts
- [ ] Installable PWA, barcode scanning, deploy
