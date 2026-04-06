import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '../utils/logger.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    display_name TEXT,
    pid INTEGER NOT NULL,
    registered_at TEXT NOT NULL,
    last_heartbeat TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    from_session_id TEXT NOT NULL,
    to_session_id TEXT,
    to_role TEXT,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'chat',
    in_reply_to TEXT,
    created_at TEXT NOT NULL,
    read_at TEXT,
    FOREIGN KEY (from_session_id) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_to_session ON messages(to_session_id, read_at);
  CREATE INDEX IF NOT EXISTS idx_messages_to_role ON messages(to_role, read_at);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
`;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function createDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA);

  // Purge sessions with dead PIDs
  const staleSessions = db.prepare('SELECT id, pid FROM sessions').all() as Array<{
    id: string;
    pid: number;
  }>;

  const toRemove = staleSessions.filter((s) => !isProcessAlive(s.pid));
  if (toRemove.length > 0) {
    const deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    const deleteMany = db.transaction((ids: string[]) => {
      for (const id of ids) {
        deleteStmt.run(id);
      }
    });
    deleteMany(toRemove.map((s) => s.id));
    logger.info(`Purged ${toRemove.length} stale session(s)`);
  }

  return db;
}

export function closeDatabase(db: Database.Database): void {
  try {
    db.close();
  } catch {
    // Already closed
  }
}
