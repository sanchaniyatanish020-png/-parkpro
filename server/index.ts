import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import compression from 'compression'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { env } from './env'
import { db } from './db'
import { broadcast, closeStreams } from './events'
import { seedIfEmpty } from './seed'
import { HttpError } from './validate'
import authRoutes from './routes/auth'
import bootstrapRoutes from './routes/bootstrap'
import demoRoutes from './routes/demo'
import eventRoutes from './routes/events'
import logRoutes from './routes/logs'
import passRoutes from './routes/passes'
import scanRoutes from './routes/scans'
import siteRoutes from './routes/site'
import syncRoutes from './routes/sync'
import walkinRoutes from './routes/walkins'

seedIfEmpty()

const app = express()
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
  if (env.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

app.use(cors({ origin: true }))
app.use(
  compression({
    // Compressing the event stream would buffer pings until the stream closes.
    filter: (req, res) => (req.path === '/api/events' ? false : compression.filter(req, res)),
  }),
)
app.use(express.json({ limit: '12mb' }))

app.use((req, res, next) => {
  if (env.isProd) return next()
  const started = Date.now()
  res.on('finish', () => {
    console.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`)
  })
  next()
})

// Any successful write is a reason for other devices to pull fresh data.
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const path = req.originalUrl.split('?')[0]
  if (path.startsWith('/api/auth') || path.startsWith('/api/events')) return next()
  res.on('finish', () => {
    if (res.statusCode < 400) broadcast(path)
  })
  next()
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, demoLogin: env.demoLogin, uptime: Math.round(process.uptime()) })
})

app.use('/api/auth', authRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/bootstrap', bootstrapRoutes)
app.use('/api/passes', passRoutes)
app.use('/api/scans', scanRoutes)
app.use('/api/walkins', walkinRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/site', siteRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/demo', demoRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' })
})

const distDir = resolve(process.cwd(), 'dist')
if (existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      index: false,
      etag: true,
      setHeaders: (res, filePath) => {
        if (/[\\/]assets[\\/]/.test(filePath)) {
          // Vite emits content-hashed filenames — safe to cache forever.
          res.setHeader('Cache-Control', env.isProd ? 'public, max-age=31536000, immutable' : 'no-cache')
        } else if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache')
        } else {
          res.setHeader('Cache-Control', env.isProd ? 'public, max-age=86400' : 'no-cache')
        }
      },
    }),
  )
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(join(distDir, 'index.html'))
  })
  console.info(`Serving built app from ${distDir}`)
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message })
    return
  }
  if (typeof error === 'object' && error && (error as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: 'Upload is too large' })
    return
  }
  console.error(error)
  res.status(500).json({ error: 'Something went wrong on the server' })
}
app.use(errorHandler)

const server = app.listen(env.port, () => {
  console.info('')
  console.info(`  ParkPro API ready on http://localhost:${env.port}`)
  console.info(`  Database: ${env.dbPath}`)
  if (env.demoLogin) {
    console.info(
      env.isProd
        ? '  Demo login: enabled via POST /api/auth/demo'
        : '  Demo login: admin / admin123 (owner) · staff / staff123 (gate)',
    )
  }
  console.info('')
})

function shutdown() {
  closeStreams()
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
