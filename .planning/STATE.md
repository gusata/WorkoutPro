# Project State

## Current Position
- Branch `feat/suggestions` (on top of `feat/health-live`): all suggested features merged.
- Last verification (2026-11-14): `tsc` clean, `eslint` clean, vitest 27 files / 212 tests passing,
  `next build` OK, Gradle `:app` + `:wear` assembleDebug/assembleRelease OK, wear unit tests OK,
  androidTest compiles, R8 keeps every Capacitor plugin method.

## Not yet verified on a device
- Health Connect: Changes API latency with the Galaxy Watch, second permission sheet (write), session showing in Samsung Health, no refresh loop after own writes
- Live HR indicator / "FC recuperada" hint / live cardio zones
- Notification buttons (+15 s, Pular, Série feita) with screen locked; rest-end alert timing
- Widget look/resize/Chronometer; shortcuts and deep links
- Wear OS: Data Layer connection, HR permission, rotary input, tile, ongoing activity, ambient
- New icon/splash on the launcher; exercise images loading on mobile data

## Known follow-ups
- Users with cloud sync must apply `supabase/schema.sql` (adds `exercises.library_id`)
- Release signing for phone + watch must use the same key
- Don't run `npx @capacitor/assets generate` (would undo the icon work; use `npm run brand:generate`)
