# Phase 1: Validation Foundation -- Context

## Phase Goal
Establish reliable verification around the existing app before making behavior changes.

## Requirements Covered
- R1: Offline local-first workout and exercise management
- R2: Live workout execution with set tracking, workout timer, rest presets, and completion summary
- R3: Persistent IndexedDB storage for workouts, exercises, sessions, measurements, profile, and achievements
- R7: JSON backup export/import
- R9: Android foreground timer service and local rest notifications

## What Already Exists
- `.planning/PROJECT.md` defines the local-first WorkoutPro scope, static-export constraint, Portuguese UI, and guided workflow preference.
- `.planning/ROADMAP.md` identifies Phase 1 as a validation foundation phase with 2 estimated plans.
- `.planning/CODEBASE.md` maps the app as a Next.js 16.2.9, React 19.2.4, TypeScript, Zustand, Dexie, and Capacitor project.
- `.planning/codebase/index.jsonl` relevant chunks:
  - `map:db:001` for Dexie schema, profile init, export, and import.
  - `map:session-store:001` for active workout lifecycle, set tracking, session completion, XP, and streak updates.
  - `map:timer-store:001` for wall-clock timer state, notifications, and Capacitor plugin calls.
  - `map:notifications:001` for Capacitor local notification permission, scheduling, and cancellation.
  - `map:timer-plugin-web:001` and `map:android-timer:001` for the native timer bridge and Android foreground service boundary.
  - `map:execute-page:001` and `map:profile-page:001` for user workflows that depend on those stores and persistence functions.
- No authored JavaScript or TypeScript tests are currently present.
- The repository already has modified non-planning files in the working tree. Build execution must preserve user changes and must not revert unrelated edits.

## Key Design Decisions
- Architecture proposals were skipped by user choice.
- Spec pipeline was skipped by user choice.
- The phase is split into two waves because behavioral tests depend on first establishing a runnable validation harness.
- Plan 01-01 owns test tooling, scripts, and the validation runbook.
- Plan 01-02 owns focused coverage for high-risk behavior and uses Plan 01-01 outputs.
- The first build executor must read `node_modules/next/dist/docs/` docs relevant to testing/configuration before changing test tooling because `AGENTS.md` explicitly warns that this Next version has changed APIs and conventions.
- Plan agents were chosen from the catalog and verified as installed under `C:/Users/gustavo.sanches/.legion/agents/`.
- GitHub issue creation is skipped because `gh` is not installed, though a GitHub remote exists.

## Plan Structure
- **Plan 01-01 (Wave 1)**: Establish Validation Tooling -- add a minimal, documented, runnable validation setup for lint/build/tests.
- **Plan 01-02 (Wave 2)**: Cover Critical Session, DB, and Timer Behaviors -- add focused behavior coverage and native/manual verification evidence for map-identified risk areas.
