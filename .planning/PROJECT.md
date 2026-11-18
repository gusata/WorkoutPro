# WorkoutPro

## What This Is
Local-first strength training tracker (Next.js 16 static export + Capacitor 8, Android first) with an optional
Supabase account for backup and multi-device sync, Health Connect integration and a Wear OS companion.
UI in Portuguese (pt-BR). Architecture, data model and invariants: `docs/BASE-DE-CONHECIMENTO.md`.

## Core Value
A polished mobile training log that works offline, keeps data on the device by default, and uses the
watch/health data the user already has to guide training (readiness, heart rate, load).

## Who It's For
Lifters who train in a gym with a phone (and optionally a Galaxy Watch / Wear OS watch).

## Requirements
### Shipped (code complete, verified by tests/builds — see STATE.md for device verification)
- R1 Workouts, exercises, 196-exercise PT-BR library with technique and illustrations
- R2 Live execution: set types, RIR/RPE, supersets, rest timer, warm-up generation, discomfort notes
- R3 Local persistence (Dexie), JSON backup, Strong/Hevy CSV, optional Supabase sync
- R4 Progress: stats, calendar, PRs, muscle map, weekly volume per muscle with targets, weight trend
- R5 Planning: mesocycles with deload, routine generator, double progression
- R6 Health: Health Connect read (Changes API, live HR), strength sessions written back, readiness with training load, live cardio with HR zones
- R7 Android: foreground timer with notification actions, home-screen widget, app shortcuts, deep links
- R8 Wear OS companion: log sets, rest timer, watch HR, tile, ongoing activity
- R9 Quality: vitest suite, Playwright web E2E/visual, Maestro device flows, instrumented timer tests

### Out of Scope (for now)
- Store publication (no signing/release pipeline yet), iOS build, social/monetization features
