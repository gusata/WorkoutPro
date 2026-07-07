# Codebase Map Search Protocol

Required artifacts:
- `.planning/CODEBASE.md`
- `.planning/codebase/index.jsonl`
- `.planning/codebase/symbols.json`
- `.planning/codebase/search.md`
- `.planning/config/directory-mappings.yaml`

## Query Planning
For a user request, extract:
- `terms`: important nouns, verbs, feature names, and technologies.
- `path_hints`: explicit files or directories.
- `symbol_hints`: classes, functions, stores, routes, or plugin names.
- `domain_hints`: likely areas such as workouts, sessions, timers, persistence, achievements, profile, stats, Android, or Capacitor.

## Retrieval Order
1. Search explicit path hints in `index.jsonl` and `symbols.json`.
2. Search symbol hints in `symbols.json`.
3. Search terms, aliases, and keywords in `index.jsonl`.
4. Search `.planning/CODEBASE.md` section headings for broad context.
5. Read original source files for the top matches before writing plans, reviews, or code.

## Ranking
Rank matches by exact path/symbol match first, then keyword overlap, same domain, risk level, and fan-in relevance. Return at most 5 primary chunks and 5 read-next paths unless the command asks for broader analysis.

## Safety Rules
- Do not treat map summaries as source of truth for code edits.
- Always read current source before changing behavior.
- If source conflicts with this map, current source wins and the map should be refreshed.
- Do not inject the full JSONL index when a targeted query is enough.

## Example
Query: `rest timer notification`

Likely matches:
- `map:timer-store:001` -> `stores/useTimerStore.ts`
- `map:notifications:001` -> `lib/notifications.ts`
- `map:timer-plugin-web:001` -> `lib/timerPlugin.ts`
- `map:android-timer:001` -> `android/app/src/main/java/com/workoutpro/app/TimerForegroundService.java`

Read next:
- `stores/useTimerStore.ts`
- `lib/notifications.ts`
- `lib/timerPlugin.ts`
- `android/app/src/main/java/com/workoutpro/app/TimerPlugin.java`
- `android/app/src/main/java/com/workoutpro/app/TimerForegroundService.java`
