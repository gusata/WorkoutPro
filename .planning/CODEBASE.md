---
map_schema_version: "2.0"
generated_at: "2026-07-06T19:31:09Z"
analyzed_commit: "5a27502f43c69b5aa8ec0efce7d1d0273d2631c1"
source_file_count: 55
source_fingerprint: "e0f1cac61496ea15757b6952b0f326fa28634afbe59549a20c029e83ca30e657"
source_fingerprint_kind: "sha256:path-size-mtime"
scope: "project-root"
---

# WorkoutPro Codebase Map

## Architecture
WorkoutPro is an offline-first, mobile-focused fitness tracker built with Next.js App Router, React client components, Zustand state stores, Dexie/IndexedDB persistence, and Capacitor Android native integration. The web app is configured for static export (`next.config.ts`) and Capacitor packages the generated `out/` directory into the Android shell.

The user-facing architecture is page-oriented under `app/`, with reusable UI and shell components under `components/`, persistent domain state in `stores/`, and business logic/data access in `lib/`. There is no backend, account system, or remote API layer; privacy and offline behavior are core architectural constraints.

## Frameworks
| Layer | Technology | Evidence |
|---|---|---|
| Framework | Next.js 16.2.9 App Router | `package.json`, `app/layout.tsx`, `app/page.tsx` |
| UI Runtime | React 19.2.4 | `package.json` |
| Language | TypeScript 5 | `tsconfig.json`, `.ts` and `.tsx` source |
| Styling | Tailwind CSS 4 via PostCSS | `package.json`, `postcss.config.mjs`, `app/globals.css` |
| State | Zustand 5 | `stores/*.ts` |
| Persistence | Dexie 4 over IndexedDB | `lib/db.ts` |
| Mobile Shell | Capacitor 8 Android/iOS deps | `capacitor.config.ts`, `android/` |
| Notifications | Capacitor Local Notifications plus Web Notifications | `lib/notifications.ts`, `stores/useTimerStore.ts` |
| Charts | Recharts 3 | `app/stats/page.tsx`, `app/profile/page.tsx` |
| Motion | Framer Motion 12 | page and component imports |
| Icons | Lucide React | page and component imports |
| Testing | No authored JS/TS test suite detected | no `*.test.*` or `*.spec.*` outside generated Android examples |

## Functionality Inventory
| Feature | Primary Files | Summary |
|---|---|---|
| App shell and bootstrapping | `app/layout.tsx`, `components/layout/AppShell.tsx` | Loads seed data, initializes workout/profile stores, registers service worker, renders bottom navigation and achievement toasts. |
| Dashboard | `app/dashboard/page.tsx` | Shows greeting, active workout banner, XP/level progress, weekly stats, totals, quick-start workout cards, and recent sessions. |
| Workout management | `app/workouts/page.tsx`, `app/workouts/new/page.tsx`, `app/workouts/detail/page.tsx`, `stores/useWorkoutStore.ts` | Creates workouts and exercises, assigns/reorders exercises, deletes workouts, and starts sessions. |
| Live workout execution | `app/workouts/execute/page.tsx`, `stores/useSessionStore.ts`, `stores/useTimerStore.ts`, `components/timer/RestTimer.tsx` | Tracks active exercises, sets, weight/reps/RPE, rest timers, completion summary, XP, and sharing. |
| Analytics | `app/stats/page.tsx` | Weekly/monthly/yearly volume charts, frequency area chart, annual heatmap, and all-time metrics. |
| Profile and body measurements | `app/profile/page.tsx`, `stores/useProfileStore.ts`, `lib/db.ts` | Edits athlete name, tracks measurements, renders weight history, exports/imports full local backup JSON. |
| Gamification | `lib/gamification.ts`, `lib/achievements.ts`, `components/achievements/AchievementToast.tsx` | XP curve, level titles, achievements, unlock checks, and transient toast display. |
| Offline/mobile integration | `components/layout/ServiceWorkerRegister.tsx`, `public/sw.js`, `lib/notifications.ts`, `lib/timerPlugin.ts`, `android/app/src/main/java/com/workoutpro/app/*.java` | Production service worker, Capacitor notification scheduling, custom Android foreground timer service. |

## Module Ownership
| Area | Paths | Responsibility |
|---|---|---|
| Routes/pages | `app/**/page.tsx`, `app/layout.tsx`, `app/manifest.ts` | User workflows and Next metadata/manifest. |
| Layout/navigation | `components/layout/`, `components/navigation/` | App shell, service worker registration, bottom navigation. |
| UI primitives | `components/ui/` | Button, card, modal, input, progress, badge primitives. |
| Domain state | `stores/` | Zustand stores for workouts, active sessions, timers, and profile/achievements. |
| Persistence and domain logic | `lib/` | Dexie schema, import/export, seed data, gamification, achievements, utilities, notifications, Capacitor plugin bridge. |
| Types | `types/index.ts` | Shared domain interfaces and union types. |
| Native Android | `android/app/src/main/java/com/workoutpro/app/`, `android/app/src/main/AndroidManifest.xml` | Capacitor entry activity, custom timer plugin, foreground service, permissions. |
| Static assets | `public/`, `icons/`, `assets/` | PWA icons, splash assets, service worker, static app assets. |

## Risks
| Risk | Level | Evidence | Planning Implication |
|---|---|---|---|
| Missing JS/TS automated tests | High | no authored `*.test.*` or `*.spec.*`; only generated Android example tests | Add focused tests before changing persistence, session completion, import/export, or timer behavior. |
| Large client pages | Medium | `app/workouts/execute/page.tsx` 387 lines, `app/stats/page.tsx` 314, `app/workouts/detail/page.tsx` 296, `app/profile/page.tsx` 292 | Feature work may benefit from extracting workflow components after behavior is covered. |
| Native timer depends on Android foreground service behavior | Medium | custom `TimerPlugin.java` and `TimerForegroundService.java`, Android 14 typed foreground service handling | Verify on device/emulator for notification and background timer changes. |
| Local backup import accepts loosely typed data | Medium | `lib/db.ts` imports `any` data into all Dexie tables after clearing | Validate backup shape before modifying import/export or exposing restore flows. |
| Static export constraints | Medium | `next.config.ts` uses `output: 'export'` and `images.unoptimized` | Avoid server-only Next APIs, dynamic server routes, and image optimization assumptions. |

## Dependency Graph
High fan-in modules:
- `types/index.ts`: consumed by stores, DB, achievements, pages, and UI workflows.
- `lib/db.ts`: consumed by profile/workout/session stores and backup flows.
- `lib/utils.ts`: consumed by pages for IDs, constants, and formatting.
- `stores/useProfileStore.ts`: consumed by dashboard, stats, profile, achievements, and live execution.
- `stores/useWorkoutStore.ts`: consumed by dashboard and workout pages.
- `stores/useSessionStore.ts`: consumed by dashboard/workouts/live execution.
- `stores/useTimerStore.ts`: consumed by live execution and rest timer UI.

Dependency direction is mostly `app/` -> `components/`/`stores/`/`lib/` -> `types/`. Native Android Java is bridged through `lib/timerPlugin.ts` and invoked indirectly by `stores/useTimerStore.ts`.

## Test Coverage
No authored JavaScript or TypeScript test suite was detected. Generated Android template tests exist under `android/app/src/test` and `android/app/src/androidTest`, but they do not cover WorkoutPro behavior.

Critical untested files ranked by behavior risk:
1. `stores/useSessionStore.ts` - session lifecycle, XP/profile updates, session persistence.
2. `lib/db.ts` - Dexie schema, backup export/import, profile initialization.
3. `stores/useTimerStore.ts` and `android/app/src/main/java/com/workoutpro/app/TimerForegroundService.java` - wall-clock timers, rest notifications, background behavior.
4. `app/profile/page.tsx` - backup import/export UX and measurement creation.
5. `app/workouts/execute/page.tsx` - live set completion and finish/share flow.

## API Surface
No HTTP API routes were detected. The app is a static client app with these local API surfaces:
- IndexedDB tables through Dexie: `workouts`, `exercises`, `sessions`, `measurements`, `profile`, `achievements`.
- Browser/PWA APIs: service worker registration, Web Notifications, clipboard, native share, file download/upload.
- Capacitor plugin bridge: `TimerPlugin.startWorkout`, `TimerPlugin.stopWorkout`, `TimerPlugin.startTimer`, `TimerPlugin.stopTimer`.
- Android service actions: `START_WORKOUT`, `START_TIMER`, `CANCEL_REST`, `STOP_WORKOUT`.

## Config/Environment
| File | Purpose |
|---|---|
| `package.json` | Scripts, Next/React/Capacitor/Dexie/Zustand/Recharts dependencies. |
| `next.config.ts` | Static export, trailing slash, compression/header settings, unoptimized images, package import optimization. |
| `capacitor.config.ts` | Capacitor app id/name, `webDir: 'out'`, Android HTTPS scheme, splash plugin setting. |
| `tsconfig.json` | Strict TypeScript, bundler module resolution, React JSX, `@/*` path alias. |
| `eslint.config.mjs` | ESLint 9 with Next config. |
| `postcss.config.mjs` | Tailwind/PostCSS wiring. |
| `android/app/src/main/AndroidManifest.xml` | Activity, foreground service, provider, and notification/service permissions. |

No `.env` files or server environment contracts were detected.

## Setup/Runbook
Common commands from `package.json`:
- `npm run dev` - start Next development server.
- `npm run build` - build static export into `out/`.
- `npm run start` - Next production server command, though static export is the packaging target.
- `npm run lint` - run ESLint.

Capacitor packaging depends on building `out/` first and then syncing/building native platforms through Capacitor tooling.

## Code Patterns
### Client-first App Router pages
Most interactive pages start with `'use client'` and read/write Zustand stores directly. App state is initialized once in `components/layout/AppShell.tsx`.

### Offline persistence store pattern
Stores read from Dexie in `load()` methods and mirror state into Zustand for rendering. Mutations write to Dexie first or optimistically update Zustand, then persist.

### Dynamic Capacitor imports
Capacitor/native modules are dynamically imported from timer and notification paths to avoid module-level SSR/dev evaluation side effects.

### Mobile-first visual system
Pages use constrained `max-w-lg` layouts, bottom navigation, dark theme styling, glass cards, Framer Motion transitions, and Lucide icons.

### Generated output separation
`.next/`, `out/`, `node_modules/`, and `android/app/build/` are generated/dependency outputs and should not be treated as source for feature planning.

## Monorepo Structure
_No data available_ - single package project; no workspace manifest or package boundary detected.

## Dependency Risk
### Outdated Packages
_No data available_ - package freshness was not checked against registries because network access was not used.

### Heavy Dependencies
- `@capacitor/*`, `recharts`, `framer-motion`, `next`, and `react` are central runtime dependencies and affect bundle/build behavior.

### Unmaintained Packages
_No data available_ - package maintenance status was not checked against registries because network access was not used.
