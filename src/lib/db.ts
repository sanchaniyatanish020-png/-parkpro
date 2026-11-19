import type { AuditLog, Pass, ScanEvent, WalkIn } from '@/types'

/** Offline cache. The Express API owns the data; IndexedDB keeps a mirror for gate work without signal. */
const DB_NAME = 'parkpro-cache'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

// Drop the pre-backend demo database once so stale local-only data does not leak in.
try {
  indexedDB.deleteDatabase('parkpro')
} catch {
  /* older browser or private mode — nothing to clean */
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const store of ['passes', 'scans', 'walkins', 'logs']) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: 'id' })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(store, mode)
        const request = run(transaction.objectStore(store))
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error)
      }),
  )
}

function getAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

function replaceStore<T>(store: string, items: T[]): Promise<void> {
  return openDatabase().then(
    (database) =>
      new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(store, 'readwrite')
        const objectStore = transaction.objectStore(store)
        objectStore.clear()
        for (const item of items) objectStore.put(item)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      }),
  )
}

function clearStore(store: string): Promise<void> {
  return tx(store, 'readwrite', (s) => s.clear())
}

export const db = {
  getPasses: () => getAll<Pass>('passes'),
  putPass: (pass: Pass) => tx('passes', 'readwrite', (s) => s.put(pass)),
  deletePass: (id: string) => tx('passes', 'readwrite', (s) => s.delete(id)),
  replacePasses: (passes: Pass[]) => replaceStore('passes', passes),

  getScans: () => getAll<ScanEvent>('scans'),
  putScan: (scan: ScanEvent) => tx('scans', 'readwrite', (s) => s.put(scan)),
  replaceScans: (scans: ScanEvent[]) => replaceStore('scans', scans),

  getWalkIns: () => getAll<WalkIn>('walkins'),
  putWalkIn: (entry: WalkIn) => tx('walkins', 'readwrite', (s) => s.put(entry)),
  replaceWalkIns: (walkins: WalkIn[]) => replaceStore('walkins', walkins),

  getLogs: () => getAll<AuditLog>('logs'),
  putLog: (log: AuditLog) => tx('logs', 'readwrite', (s) => s.put(log)),
  clearLogs: () => clearStore('logs'),
  replaceLogs: (logs: AuditLog[]) => replaceStore('logs', logs),

  clearAll: async () => {
    await Promise.all(['passes', 'scans', 'walkins', 'logs'].map(clearStore))
  },
}
