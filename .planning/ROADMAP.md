# WorkoutPro - Roadmap

## Done (2026-11, branch feat/suggestions)
- [x] Linux build setup (SDK without Android Studio, JDK 21, gradlew), Node 26 test fix
- [x] Automatic health updates via Health Connect Changes API
- [x] Live heart rate in workouts + HR-based rest hint; strength sessions written to Health Connect
- [x] Live cardio with real-time HR zones
- [x] Exercise library (196, PT-BR, instructions, free-exercise-db images)
- [x] Muscle map, weekly volume per muscle with targets, richer readiness + load adjustment, weight trend
- [x] Mesocycles with deload, routine generator (uses the library), auto warm-ups, discomfort notes
- [x] Android widget, timer notification actions, app shortcuts / deep links
- [x] Wear OS companion app + phone Data Layer bridge
- [x] Maestro device flows, instrumented timer tests, definitive icon/splash art

## Next
1. Device verification on the real phone and watch (checklist in STATE.md)
2. Apply `supabase/schema.sql` (new `library_id` column) to the Supabase project before shipping sync
3. Run `npm run test:device` on an emulator and fix selectors
4. Release pipeline: upload keystore, versionCode/versionName, internal testing track (docs/ANDROID-RELEASE.md)
