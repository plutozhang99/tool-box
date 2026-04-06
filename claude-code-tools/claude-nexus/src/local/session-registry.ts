import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Session } from '../types.js';
import { logger } from '../utils/logger.js';

export function registerSession(
  db: Database.Database,
  role: string,
  displayName?: string,
): Session {
  const id = uuidv4();
  const now = new Date().toISOString();
  const pid = process.pid;

  db.prepare(
    `INSERT INTO sessions (id, role, display_name, pid, registered_at, last_heartbeat)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, role, displayName ?? null, pid, now, now);

  logger.info(`Session registered: ${role}`, { id, pid });

  return {
    id,
    role,
    display_name: displayName ?? null,
    pid,
    registered_at: now,
    last_heartbeat: now,
  };
}

export function deregisterSession(db: Database.Database, sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  logger.info(`Session deregistered`, { sessionId });
}

export function listSessions(
  db: Database.Database,
  roleFilter?: string,
): readonly Session[] {
  if (roleFilter) {
    return db
      .prepare('SELECT * FROM sessions WHERE role = ? ORDER BY registered_at')
      .all(roleFilter) as Session[];
  }
  return db.prepare('SELECT * FROM sessions ORDER BY registered_at').all() as Session[];
}

export function heartbeat(db: Database.Database, sessionId: string): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE sessions SET last_heartbeat = ? WHERE id = ?').run(now, sessionId);
}

export function pruneStale(db: Database.Database, maxAgeMs: number): number {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const result = db
    .prepare('DELETE FROM sessions WHERE last_heartbeat < ?')
    .run(cutoff);
  if (result.changes > 0) {
    logger.info(`Pruned ${result.changes} stale session(s)`);
  }
  return result.changes;
}

export function getSession(
  db: Database.Database,
  sessionId: string,
): Session | undefined {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as
    | Session
    | undefined;
}
