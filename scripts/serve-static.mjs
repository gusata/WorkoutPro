import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'

const root = path.resolve('out')
const portFlag = process.argv.indexOf('--port')
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT ?? 3011)

if (!existsSync(root)) {
  console.error('Diretorio out ausente. Execute npm run build primeiro.')
  process.exit(1)
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

function resolveRequest(pathname) {
  const decoded = decodeURIComponent(pathname)
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const candidates = [relative]
  const basename = path.posix.basename(relative)
  const rscPage = basename.match(/^__next\.([^.]+(?:\.[^.]+)*)\.__PAGE__\.txt$/)
  if (rscPage) {
    const [firstSegment, ...remainingSegments] = rscPage[1].split('.')
    candidates.push(path.join(
      path.posix.dirname(relative),
      `__next.${firstSegment}`,
      ...remainingSegments,
      '__PAGE__.txt',
    ))
  }
  if (relative.endsWith('/')) candidates.push(`${relative}index.html`)
  else if (!path.extname(relative)) candidates.push(`${relative}.html`, `${relative}/index.html`)

  for (const candidate of candidates) {
    const resolved = path.resolve(root, candidate)
    if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) continue
    if (existsSync(resolved) && statSync(resolved).isFile()) return resolved
  }
  return path.join(root, '404.html')
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const file = resolveRequest(url.pathname)
  const isNotFound = file.endsWith(`${path.sep}404.html`) && url.pathname !== '/404.html'
  response.writeHead(isNotFound ? 404 : 200, {
    'Content-Type': mimeTypes[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(file).pipe(response)
})

function shutdown() {
  server.close(() => process.exit(0))
  server.closeAllConnections()
  setTimeout(() => process.exit(0), 1000).unref()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

server.listen(port, '127.0.0.1', () => {
  console.log(`WorkoutPro static server: http://127.0.0.1:${port}`)
})
