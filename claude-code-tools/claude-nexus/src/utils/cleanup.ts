import type Database from 'better-sqlite3';
import { deregisterSession } from '../local/session-registry.js';
import { closeDatabase } from '../local/database.js';
import { logger } from './logger.js';

// HIGH-6 + MED-18: Enforce single-call semantics and use process.once
let setupDone = false;

export function setupCleanup(db: Database.Database, sessionId: string): void {
  if (setupDone) {
    logger.warn('setupCleanup called more than once — ignoring duplicate');
    return;
  }
  setupDone = true;

  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      deregisterSession(db, sessionId);
      closeDatabase(db);
      logger.info('Cleanup complete');
    } catch {
      // Best effort during shutdown
    }
  };

  process.on('exit', cleanup);
  process.once('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  // LOW-3: Log full stack trace on uncaught exception
  process.once('uncaughtException', (err) => {
    logger.error('Uncaught exception', {
      error: String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    cleanup();
    process.exit(1);
  });
}
