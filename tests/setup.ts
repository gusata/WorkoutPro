import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// Node 25+ ships its own global `localStorage`, which is undefined without
// --localstorage-file and shadows jsdom's. Put jsdom's Storage back.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window
if (jsdomWindow && typeof globalThis.localStorage?.getItem !== 'function') {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, { configurable: true, value: jsdomWindow[name] })
  }
}
