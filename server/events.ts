import type { Response } from 'express'

interface Client {
  res: Response
  lastSent: number
  pending: ReturnType<typeof setTimeout> | null
  close: () => void
}

const clients = new Set<Client>()
const HEARTBEAT_MS = 25_000
const COALESCE_MS = 300

function write(client: Client, kind: string): void {
  if (client.res.writableEnded) return
  client.res.write(`event: change\ndata: ${JSON.stringify({ kind, at: new Date().toISOString() })}\n\n`)
}

/** Pings every open stream; writes within the same moment (scan + audit log) collapse into one ping. */
export function broadcast(kind: string): void {
  if (clients.size === 0) return
  const now = Date.now()
  for (const client of clients) {
    const wait = COALESCE_MS - (now - client.lastSent)
    if (wait <= 0) {
      client.lastSent = now
      write(client, kind)
    } else if (!client.pending) {
      client.pending = setTimeout(() => {
        client.pending = null
        client.lastSent = Date.now()
        write(client, kind)
      }, wait)
    }
  }
}

/** Ends every open stream so a graceful shutdown does not wait on them. */
export function closeStreams(): void {
  for (const client of clients) {
    client.close()
    if (!client.res.writableEnded) client.res.end()
  }
}

export function subscribe(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  res.write('retry: 5000\n\n')

  const client: Client = { res, lastSent: Date.now(), pending: null, close: () => undefined }
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n')
  }, HEARTBEAT_MS)

  client.close = () => {
    clearInterval(heartbeat)
    if (client.pending) clearTimeout(client.pending)
    clients.delete(client)
  }

  clients.add(client)
  res.on('close', client.close)
}
