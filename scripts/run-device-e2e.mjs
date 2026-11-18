#!/usr/bin/env node
/**
 * Device E2E runner: builds the debug APK, installs it on ONE explicit device and runs the
 * Maestro flows in e2e/maestro (timer, notifications, reminders, background/resume).
 *
 *   npm run test:device -- --device emulator-5554
 *   npm run test:device -- --device emulator-5554 --skip-build --flow e2e/maestro/flows/02-rest-timer-notification.yaml
 *   npm run test:device -- --device emulator-5554 --instrumented   # also runs androidTest (JUnit4)
 *
 * The flows ERASE all WorkoutPro data on the target (Maestro clearState = `pm clear`).
 * Physical devices additionally need --allow-physical-device.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const APP_ID = 'com.workoutpro.app'
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const isWindows = process.platform === 'win32'

function usage(message) {
  if (message) console.error(`\n[test:device] ${message}\n`)
  console.error(`Uso: npm run test:device -- --device <serial> [opcoes]

  --device <serial>          Obrigatorio. Serial do adb (ex.: emulator-5554). Nunca ha alvo padrao.
  --allow-physical-device    Necessario quando o serial nao e de um emulador (use um aparelho reserva).
  --skip-build               Nao roda next build / cap sync / assembleDebug (usa o APK existente).
  --skip-install             Nao reinstala o APK.
  --flow <arquivo|pasta>     Roda so este fluxo/pasta (padrao: e2e/maestro inteiro).
  --instrumented             Tambem roda os testes instrumentados (connectedDebugAndroidTest).
  --yes                      Pula a contagem regressiva de 10 s antes de apagar os dados.
  --dry-run                  So mostra os comandos, sem executar nada.
`)
  process.exit(2)
}

function parseArgs(argv) {
  const options = { device: null, allowPhysical: false, skipBuild: false, skipInstall: false, flow: null, instrumented: false, yes: false, dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) usage(`${arg} precisa de um valor.`)
      index += 1
      return next
    }
    if (arg === '--device' || arg === '-d') options.device = value()
    else if (arg.startsWith('--device=')) options.device = arg.slice('--device='.length)
    else if (arg === '--allow-physical-device') options.allowPhysical = true
    else if (arg === '--skip-build') options.skipBuild = true
    else if (arg === '--skip-install') options.skipInstall = true
    else if (arg === '--flow') options.flow = value()
    else if (arg === '--instrumented') options.instrumented = true
    else if (arg === '--yes' || arg === '-y') options.yes = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--help' || arg === '-h') usage()
    else usage(`Argumento desconhecido: ${arg}`)
  }
  return options
}

const options = parseArgs(process.argv.slice(2))
if (!options.device || !options.device.trim()) {
  usage('Recusado: informe explicitamente o aparelho com --device <serial>. Os fluxos APAGAM os dados do app.')
}
const serial = options.device.trim()
const isEmulator = /^emulator-\d+$/.test(serial) || /^localhost:\d+$|^127\.0\.0\.1:\d+$/.test(serial)

const banner = [
  '',
  '############################################################################',
  '#                                                                          #',
  '#   ATENCAO: OS TESTES DE DISPOSITIVO APAGAM TODOS OS DADOS DO WORKOUTPRO   #',
  `#   (${APP_ID}) NO APARELHO ${serial.padEnd(37).slice(0, 37)}#`,
  '#                                                                          #',
  '#   Treinos, historico, fotos e ajustes locais serao perdidos (pm clear).  #',
  '#   Use um EMULADOR ou um APARELHO RESERVA, nunca o seu celular pessoal.   #',
  '#                                                                          #',
  '############################################################################',
  '',
].join('\n')
console.warn(banner)

if (!isEmulator && !options.allowPhysical) {
  usage(`Recusado: "${serial}" nao parece um emulador. Para um aparelho reserva sem dados reais, repita com --allow-physical-device.`)
}

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.HOME || '', 'Android/Sdk')
const adbBin = existsSync(path.join(sdk, 'platform-tools', isWindows ? 'adb.exe' : 'adb')) ? path.join(sdk, 'platform-tools', isWindows ? 'adb.exe' : 'adb') : 'adb'
const maestroBin = process.env.MAESTRO_BIN || 'maestro'
const gradlew = isWindows ? 'gradlew.bat' : './gradlew'
const apk = path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk')
const reportDir = path.join(root, 'test-results/maestro')

function run(command, args, { cwd = root, env = {}, capture = false } = {}) {
  const printable = [command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(' ')
  console.log(`\n$ ${printable}${cwd !== root ? `   (em ${path.relative(root, cwd) || '.'})` : ''}`)
  if (options.dryRun) return ''
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    shell: isWindows,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    console.error(`\n[test:device] Falhou (codigo ${result.status}): ${printable}`)
    process.exit(result.status ?? 1)
  }
  return capture ? result.stdout : ''
}

async function countdown(seconds) {
  if (options.yes || options.dryRun || !process.stdin.isTTY) return
  console.warn(`Ctrl+C para cancelar. Comecando em ${seconds} s...`)
  for (let left = seconds; left > 0; left -= 1) {
    process.stderr.write(`  ${left}...`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  process.stderr.write('\n')
}

// 1. The target must be connected — never fall back to "the only device".
if (!options.dryRun) {
  const devices = run(adbBin, ['devices'], { capture: true })
  const connected = devices.split('\n').slice(1).map((line) => line.trim().split(/\s+/)).filter(([id, state]) => id && state === 'device').map(([id]) => id)
  if (!connected.includes(serial)) {
    console.error(`[test:device] "${serial}" nao esta conectado/autorizado. Aparelhos: ${connected.join(', ') || 'nenhum'}`)
    process.exit(2)
  }
} else {
  run(adbBin, ['devices'])
}

await countdown(10)

// 2. Build the debug APK from the current web bundle.
if (!options.skipBuild) {
  run('npm', ['run', 'build'])
  run('npx', ['cap', 'sync', 'android'])
  run(gradlew, ['--no-daemon', 'assembleDebug'], { cwd: path.join(root, 'android') })
}
if (!options.dryRun && !existsSync(apk)) {
  console.error(`[test:device] APK nao encontrado: ${apk}. Rode sem --skip-build.`)
  process.exit(1)
}

// 3. Install on the chosen device only.
if (!options.skipInstall) run(adbBin, ['-s', serial, 'install', '-r', '-t', apk])

// 4. Optional native instrumented tests (TimerForegroundService).
if (options.instrumented) {
  run(gradlew, ['--no-daemon', 'connectedDebugAndroidTest'], { cwd: path.join(root, 'android'), env: { ANDROID_SERIAL: serial } })
}

// 5. Maestro flows. WORKOUTPRO_E2E_ALLOW_WIPE=1 is what lets the flows call clearState.
if (!options.dryRun) mkdirSync(reportDir, { recursive: true })
const target = options.flow ? path.resolve(root, options.flow) : path.join(root, 'e2e/maestro')
run(maestroBin, [
  'test',
  '--device', serial,
  '-e', 'WORKOUTPRO_E2E_ALLOW_WIPE=1',
  '--format', 'JUNIT',
  '--output', path.join(reportDir, 'report.xml'),
  '--test-output-dir', reportDir,
  target,
], { env: { MAESTRO_CLI_NO_ANALYTICS: '1' } })

console.log(`\n[test:device] OK. Relatorio: ${path.relative(root, reportDir)}/report.xml`)
