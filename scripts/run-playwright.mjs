import { spawn } from 'node:child_process'
import path from 'node:path'

const server = spawn(process.execPath, ['scripts/serve-static.mjs', '--port', '3011'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'inherit'],
})

server.stdout.on('data', (chunk) => process.stdout.write(`[static] ${chunk}`))

async function waitForServer() {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (server.exitCode != null) throw new Error(`Servidor estatico encerrou com codigo ${server.exitCode}`)
    try {
      const response = await fetch('http://127.0.0.1:3011/dashboard/')
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Servidor estatico nao respondeu em 15 segundos')
}

function waitForExit(child) {
  return new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)))
}

let exitCode = 1
try {
  await waitForServer()
  const playwrightCli = path.resolve('node_modules/@playwright/test/cli.js')
  const runner = spawn(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  exitCode = await waitForExit(runner)
} finally {
  server.kill('SIGTERM')
  await Promise.race([waitForExit(server), new Promise((resolve) => setTimeout(resolve, 1500))])
}

process.exit(exitCode)
