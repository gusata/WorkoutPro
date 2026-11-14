#!/usr/bin/env node
/**
 * Single source of truth for the WorkoutPro mark (dumbbell whose bar is a "W" pulse).
 *
 * Writes the SVG sources in assets/brand/, the Capacitor asset sources in assets/,
 * the Android vector drawables / legacy mipmaps and the PWA icons.
 * Needs `rsvg-convert` (librsvg) and ImageMagick (`magick`) on the PATH.
 *
 *   node scripts/generate-brand-assets.mjs            # write everything
 *   node scripts/generate-brand-assets.mjs --preview <out.png>   # also render a contact sheet
 *
 * Do NOT run `npx @capacitor/assets generate` afterwards: it would bring back one splash PNG per
 * density/orientation/theme (the duplicate/density Android Lint warnings this replaces).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const res = path.join(root, 'android/app/src/main/res')

// ---- Palette (app/globals.css --accent / --accent-fill) -------------------------------------
export const BRAND = {
  gradientStart: '#2B95FF',
  gradientEnd: '#0060CF',
  accentFill: '#0071E3',
  mark: '#FFFFFF',
  splashLight: '#F5F5F7',
  splashDark: '#000000',
}

// ---- Geometry, in the 108x108 adaptive-icon canvas (safe zone: r = 33 around 54,54) ----------
// Drawn on a 0..108 grid, then scaled around the center so the mark sits well inside the circle mask.
const SCALE = 0.86
const s = (value) => 54 + (value - 54) * SCALE
const PLATES = [26, 73].map((x) => ({ x: s(x), y: s(37), w: 9 * SCALE, h: 34 * SCALE, r: 4.5 * SCALE }))
const PULSE = [[35, 54], [41, 54], [46.5, 65], [54, 43], [61.5, 65], [67, 54], [73, 54]].map(([x, y]) => [s(x), s(y)])
const PULSE_WIDTH = Number((6.5 * SCALE).toFixed(3))

const n = (value) => Number(value.toFixed(3)).toString()

function roundedRectPath({ x, y, w, h, r }) {
  return [
    `M${n(x + r)},${n(y)}`,
    `h${n(w - 2 * r)}`,
    `a${n(r)},${n(r)} 0 0 1 ${n(r)},${n(r)}`,
    `v${n(h - 2 * r)}`,
    `a${n(r)},${n(r)} 0 0 1 ${n(-r)},${n(r)}`,
    `h${n(-(w - 2 * r))}`,
    `a${n(r)},${n(r)} 0 0 1 ${n(-r)},${n(-r)}`,
    `v${n(-(h - 2 * r))}`,
    `a${n(r)},${n(r)} 0 0 1 ${n(r)},${n(-r)}`,
    'z',
  ].join('')
}

const platesPath = PLATES.map(roundedRectPath).join('')
const pulsePath = PULSE.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${n(x)},${n(y)}`).join('')

// ---- SVG building blocks --------------------------------------------------------------------
function markSvg(color) {
  return `<path fill="${color}" d="${platesPath}"/>`
    + `<path fill="none" stroke="${color}" stroke-width="${PULSE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" d="${pulsePath}"/>`
}

const gradientDef = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="108" y2="108" gradientUnits="userSpaceOnUse">`
  + `<stop offset="0" stop-color="${BRAND.gradientStart}"/><stop offset="1" stop-color="${BRAND.gradientEnd}"/></linearGradient>`

const svg = (viewBox, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`

/** Visible area of an adaptive icon is the central 72x72 of the 108 canvas. */
const VISIBLE = '18 18 72 72'

const SOURCES = {
  // Adaptive icon layers (full 108 canvas).
  'icon-foreground': svg('0 0 108 108', markSvg(BRAND.mark)),
  'icon-background': svg('0 0 108 108', '<rect width="108" height="108" fill="url(#bg)"/>', gradientDef('bg')),
  'icon-monochrome': svg('0 0 108 108', markSvg('#000000')),
  // Full-bleed square (maskable PWA, apple-touch, Play listing).
  'icon-full-bleed': svg('0 0 108 108', `<rect width="108" height="108" fill="url(#bg)"/>${markSvg(BRAND.mark)}`, gradientDef('bg')),
  // Legacy launcher shapes and PWA "any" icon.
  'icon-legacy-square': svg(VISIBLE, `<rect x="19" y="19" width="70" height="70" rx="16" fill="url(#bg)"/>${markSvg(BRAND.mark)}`, gradientDef('bg')),
  'icon-legacy-round': svg(VISIBLE, `<circle cx="54" cy="54" r="35" fill="url(#bg)"/>${markSvg(BRAND.mark)}`, gradientDef('bg')),
  // Notification small icon / web push badge (white on transparent, cropped to the mark).
  'icon-notification': svg('25 25 58 58', markSvg('#FFFFFF')),
  // Splash screens: the round icon on the theme background (2732 canvas = 108 units).
  'splash-light': svg('0 0 108 108', `<rect width="108" height="108" fill="${BRAND.splashLight}"/><circle cx="54" cy="54" r="14" fill="url(#bg)"/><g transform="translate(54 54) scale(0.3889) translate(-54 -54)">${markSvg(BRAND.mark)}</g>`, gradientDef('bg').replace('x1="0" y1="0" x2="108" y2="108"', 'x1="40" y1="40" x2="68" y2="68"')),
  'splash-dark': svg('0 0 108 108', `<rect width="108" height="108" fill="${BRAND.splashDark}"/><circle cx="54" cy="54" r="14" fill="url(#bg)"/><g transform="translate(54 54) scale(0.3889) translate(-54 -54)">${markSvg(BRAND.mark)}</g>`, gradientDef('bg').replace('x1="0" y1="0" x2="108" y2="108"', 'x1="40" y1="40" x2="68" y2="68"')),
}

// ---- Android vector drawables ---------------------------------------------------------------
const VECTOR_NS = 'xmlns:android="http://schemas.android.com/apk/res/android"'
const AAPT_NS = 'xmlns:aapt="http://schemas.android.com/aapt"'

function vectorMark(color, { size = 108, viewport = [0, 0, 108, 108] } = {}) {
  const [x, y, w, h] = viewport
  const translate = x || y ? `\n    <group android:translateX="${n(-x)}" android:translateY="${n(-y)}">` : ''
  const indent = translate ? '        ' : '    '
  const body = `${indent}<path\n${indent}    android:fillColor="${color}"\n${indent}    android:pathData="${platesPath}" />\n`
    + `${indent}<path\n${indent}    android:fillColor="#00000000"\n${indent}    android:strokeColor="${color}"\n${indent}    android:strokeWidth="${PULSE_WIDTH}"\n`
    + `${indent}    android:strokeLineCap="round"\n${indent}    android:strokeLineJoin="round"\n${indent}    android:pathData="${pulsePath}" />\n`
  return `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by scripts/generate-brand-assets.mjs. Do not edit by hand. -->\n`
    + `<vector ${VECTOR_NS}\n    android:width="${size}dp"\n    android:height="${size}dp"\n    android:viewportWidth="${w}"\n    android:viewportHeight="${h}">`
    + `${translate}\n${body}${translate ? '    </group>\n' : ''}</vector>\n`
}

const VECTOR_BACKGROUND = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-brand-assets.mjs. Do not edit by hand. -->
<vector ${VECTOR_NS}
    ${AAPT_NS}
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:type="linear"
                android:startX="0"
                android:startY="0"
                android:endX="108"
                android:endY="108"
                android:startColor="${BRAND.gradientStart}"
                android:endColor="${BRAND.gradientEnd}" />
        </aapt:attr>
    </path>
</vector>
`

const ADAPTIVE_ICON = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-brand-assets.mjs. Do not edit by hand. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`

/** Pre-Android 12 launch window background: theme color + round icon, no bitmaps. */
const SPLASH_LAYER_LIST = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-brand-assets.mjs. Do not edit by hand.
     The background color switches with values-night/colors.xml. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background" />
    <item
        android:width="96dp"
        android:height="96dp"
        android:gravity="center">
        <layer-list>
            <item android:drawable="@drawable/ic_launcher_background_round" />
            <item android:drawable="@drawable/ic_launcher_foreground" />
        </layer-list>
    </item>
</layer-list>
`

// Round gradient used by the splash layer-list (circle = adaptive icon visible area).
const VECTOR_BACKGROUND_ROUND = VECTOR_BACKGROUND
  .replace('M0,0h108v108h-108z', 'M54,18a36,36 0 1 1 0,72a36,36 0 1 1 0,-72z')

const colorsXml = (splash) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-brand-assets.mjs. Do not edit by hand. -->
<resources>
    <color name="splash_background">${splash}</color>
    <color name="brand_accent">${BRAND.accentFill}</color>
</resources>
`

// ---- Rendering ------------------------------------------------------------------------------
function render(svgFile, out, width, height = width) {
  mkdirSync(path.dirname(out), { recursive: true })
  execFileSync('rsvg-convert', ['-w', String(width), '-h', String(height), svgFile, '-o', out])
  // Strip metadata (timestamps) so re-running the script gives byte-identical PNGs.
  execFileSync('magick', [out, '-strip', '-define', 'png:exclude-chunks=date,time', out])
}

function write(file, content) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

function main() {
  const brandDir = path.join(root, 'assets/brand')
  for (const [name, content] of Object.entries(SOURCES)) write(path.join(brandDir, `${name}.svg`), content)
  const src = (name) => path.join(brandDir, `${name}.svg`)

  // Capacitor asset sources (kept for reference / store listing; Android res is generated below).
  render(src('icon-full-bleed'), path.join(root, 'assets/icon-only.png'), 1024)
  render(src('icon-foreground'), path.join(root, 'assets/icon-foreground.png'), 1024)
  render(src('icon-background'), path.join(root, 'assets/icon-background.png'), 1024)
  render(src('splash-light'), path.join(root, 'assets/splash.png'), 2732)
  render(src('splash-dark'), path.join(root, 'assets/splash-dark.png'), 2732)
  render(src('icon-legacy-square'), path.join(root, 'assets/play-store-icon-512.png'), 512)

  // Android: vectors for the adaptive icon, splash and notification icon.
  write(path.join(res, 'drawable/ic_launcher_foreground.xml'), vectorMark('#FFFFFFFF'))
  write(path.join(res, 'drawable/ic_launcher_monochrome.xml'), vectorMark('#FF000000'))
  write(path.join(res, 'drawable/ic_launcher_background.xml'), VECTOR_BACKGROUND)
  write(path.join(res, 'drawable/ic_launcher_background_round.xml'), VECTOR_BACKGROUND_ROUND)
  write(path.join(res, 'drawable/ic_stat_workoutpro.xml'), vectorMark('#FFFFFFFF', { size: 24, viewport: [25, 25, 58, 58] }))
  write(path.join(res, 'drawable/splash.xml'), SPLASH_LAYER_LIST)
  write(path.join(res, 'mipmap-anydpi/ic_launcher.xml'), ADAPTIVE_ICON)
  write(path.join(res, 'mipmap-anydpi/ic_launcher_round.xml'), ADAPTIVE_ICON)
  write(path.join(res, 'values/colors.xml'), colorsXml(BRAND.splashLight))
  write(path.join(res, 'values-night/colors.xml'), colorsXml(BRAND.splashDark))

  // Legacy bitmaps (only used by launchers/tools that ignore mipmap-anydpi).
  for (const [density, scale] of Object.entries(DENSITIES)) {
    render(src('icon-legacy-square'), path.join(res, `mipmap-${density}/ic_launcher.png`), Math.round(48 * scale))
    render(src('icon-legacy-round'), path.join(res, `mipmap-${density}/ic_launcher_round.png`), Math.round(48 * scale))
  }

  // PWA (app/manifest.ts, app/layout.tsx, public/sw.js).
  const pub = path.join(root, 'public/icons')
  write(path.join(pub, 'icon.svg'), SOURCES['icon-legacy-square'])
  render(src('icon-legacy-square'), path.join(pub, 'icon-192.png'), 192)
  render(src('icon-legacy-square'), path.join(pub, 'icon-512.png'), 512)
  render(src('icon-full-bleed'), path.join(pub, 'icon-maskable-192.png'), 192)
  render(src('icon-full-bleed'), path.join(pub, 'icon-maskable-512.png'), 512)
  render(src('icon-full-bleed'), path.join(pub, 'apple-touch-icon.png'), 180)
  render(src('icon-notification'), path.join(pub, 'badge-96.png'), 96)

  // Favicon (16/32/48 inside one .ico).
  const tmp = mkdtempSync(path.join(tmpdir(), 'workoutpro-favicon-'))
  try {
    const sizes = [16, 32, 48].map((size) => {
      const out = path.join(tmp, `${size}.png`)
      render(src('icon-legacy-square'), out, size)
      return out
    })
    execFileSync('magick', [...sizes, path.join(root, 'app/favicon.ico')])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  const previewIndex = process.argv.indexOf('--preview')
  if (previewIndex > 0) preview(process.argv[previewIndex + 1] ?? path.join(tmpdir(), 'workoutpro-brand-preview.png'))
}

/** Contact sheet: launcher shapes at real sizes on light/dark wallpapers, themed icon, splashes. */
function preview(out) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'workoutpro-preview-'))
  const src = (name) => path.join(root, 'assets/brand', `${name}.svg`)
  const tile = (name, size, file) => { const p = path.join(tmp, file); render(src(name), p, size); return p }
  // Simulated launcher masks over the adaptive layers, and the themed (monochrome) icon.
  const fromSvg = (content, size, file) => {
    const svgFile = path.join(tmp, `${file}.svg`)
    write(svgFile, content)
    const p = path.join(tmp, `${file}.png`)
    render(svgFile, p, size)
    return p
  }
  const clip = (shape) => shape === 'circle' ? '<circle cx="54" cy="54" r="36"/>' : '<rect x="18" y="18" width="72" height="72" rx="16"/>'
  const masked = (shape, size, file) => fromSvg(svg(VISIBLE,
    `<g clip-path="url(#m)"><rect width="108" height="108" fill="url(#bg)"/>${markSvg(BRAND.mark)}</g>`,
    `${gradientDef('bg')}<clipPath id="m">${clip(shape)}</clipPath>`), size, file)
  const themed = (size, file, bg, fg) => fromSvg(svg(VISIBLE, `<circle cx="54" cy="54" r="36" fill="${bg}"/>${markSvg(fg)}`), size, file)
  const rows = []
  for (const [label, wallpaper, themedBg, themedFg] of [['light', '#E9E9EE', '#D8E3F8', '#0B3A7A'], ['dark', '#1C1C1E', '#0B2545', '#BFD7FF']]) {
    const items = [
      masked('circle', 192, `${label}-c192`), masked('rounded', 96, `${label}-r96`), masked('circle', 48, `${label}-c48`),
      masked('rounded', 36, `${label}-r36`), themed(96, `${label}-t96`, themedBg, themedFg), themed(48, `${label}-t48`, themedBg, themedFg),
      tile('icon-legacy-square', 48, `${label}-legacy48.png`), tile('icon-legacy-round', 48, `${label}-legacyr48.png`),
      tile('icon-notification', 24, `${label}-stat24.png`), tile('icon-legacy-square', 16, `${label}-fav16.png`),
    ]
    const row = path.join(tmp, `${label}-row.png`)
    execFileSync('magick', ['-background', wallpaper, ...items.flatMap((item) => ['(', item, '-bordercolor', wallpaper, '-border', '14', ')']), '-gravity', 'center', '+append', row])
    rows.push(row)
  }
  const splashes = path.join(tmp, 'splashes.png')
  execFileSync('magick', ['-background', '#888888',
    '(', tile('splash-light', 300, 'sl.png'), '-gravity', 'center', '-background', BRAND.splashLight, '-extent', '300x520', '-bordercolor', '#888888', '-border', '8', ')',
    '(', tile('splash-dark', 300, 'sd.png'), '-gravity', 'center', '-background', BRAND.splashDark, '-extent', '300x520', '-bordercolor', '#888888', '-border', '8', ')',
    '(', tile('icon-full-bleed', 260, 'mask.png'), '-bordercolor', '#888888', '-border', '8', ')',
    '-background', '#888888', '+append', splashes])
  execFileSync('magick', [...rows, splashes, '-background', '#888888', '-gravity', 'west', '-append', '-alpha', 'remove', '-alpha', 'off', out])
  rmSync(tmp, { recursive: true, force: true })
  console.log(`preview: ${out}`)
}

main()
