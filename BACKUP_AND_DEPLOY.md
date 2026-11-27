# ParkPro — Database Persistence, Backup & Restore Guide

## 1. Database Persistence on Render
ParkPro stores all data in SQLite (`DB_PATH`, defaulting to `./data/parkpro.db` in WAL mode).

- **Render Free Plan**: The local filesystem is ephemeral and resets on service restarts/redeploys.
- **Permanent Persistence on Render**:
  1. Upgrade the Render web service from **Free** to **Starter** (or higher).
  2. In Render Dashboard → **Disks** → **Add Disk**:
     - **Mount Path**: `/var/data`
     - **Size**: `1 GB` (sufficient for thousands of passes and scans)
  3. In Render Dashboard → **Environment** → **Add Environment Variable**:
     - `DB_PATH=/var/data/parkpro.db`
     - `DEMO_LOGIN=false` (recommended for production)

## 2. Manual Backup (Local or Server)
Because ParkPro uses SQLite in WAL mode, back up the database safely using SQLite's `.backup` or Node's `DatabaseSync`:

```bash
# Option A: Using sqlite3 CLI
sqlite3 data/parkpro.db ".backup 'backup-parkpro.db'"

# Option B: Using Node.js (creates a clean, consistent snapshot)
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('data/parkpro.db'); db.exec(\"VACUUM INTO 'backup-parkpro.db'\");"
```

## 3. Restore from Backup
1. Stop the ParkPro server (`Ctrl+C` or `taskkill /F /IM node.exe`).
2. Replace `data/parkpro.db` (and remove stale `-wal` / `-shm` files if present) with your `backup-parkpro.db`:
   ```bash
   cp backup-parkpro.db data/parkpro.db
   rm -f data/parkpro.db-wal data/parkpro.db-shm
   ```
3. Start the server again (`npm start` or `npm run dev:full`).
