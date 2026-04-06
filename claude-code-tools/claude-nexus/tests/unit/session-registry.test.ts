import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, closeDatabase } from '../../src/local/database.js';
import {
  registerSession,
  deregisterSession,
  listSessions,
  heartbeat,
  pruneStale,
  getSession,
} from '../../src/local/session-registry.js';
import type Database from 'better-sqlite3';

describe('session-registry', () => {
  let tempDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nexus-test-'));
    db = createDatabase(join(tempDir, 'test.db'));
  });

  afterEach(() => {
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers a session', () => {
    const session = registerSession(db, 'frontend', 'FE Dev');
    expect(session.role).toBe('frontend');
    expect(session.display_name).toBe('FE Dev');
    expect(session.pid).toBe(process.pid);
    expect(session.id).toBeDefined();
  });

  it('lists sessions', () => {
    registerSession(db, 'frontend');
    registerSession(db, 'backend');
    registerSession(db, 'cto');

    const all = listSessions(db);
    expect(all).toHaveLength(3);
  });

  it('filters sessions by role', () => {
    registerSession(db, 'frontend');
    registerSession(db, 'backend');
    registerSession(db, 'frontend');

    const frontends = listSessions(db, 'frontend');
    expect(frontends).toHaveLength(2);
    expect(frontends.every((s) => s.role === 'frontend')).toBe(true);
  });

  it('deregisters a session', () => {
    const session = registerSession(db, 'backend');
    deregisterSession(db, session.id);
    const found = getSession(db, session.id);
    expect(found).toBeUndefined();
  });

  it('updates heartbeat', () => {
    const session = registerSession(db, 'cto');
    const before = getSession(db, session.id)!.last_heartbeat;

    // Small delay to ensure timestamp differs
    heartbeat(db, session.id);
    const after = getSession(db, session.id)!.last_heartbeat;
    expect(after).toBeDefined();
  });

  it('prunes stale sessions', () => {
    const session = registerSession(db, 'frontend');
    // Set heartbeat to 5 minutes ago
    const oldTime = new Date(Date.now() - 300000).toISOString();
    db.prepare('UPDATE sessions SET last_heartbeat = ? WHERE id = ?').run(
      oldTime,
      session.id,
    );

    const pruned = pruneStale(db, 120000); // 2 minute threshold
    expect(pruned).toBe(1);
    expect(listSessions(db)).toHaveLength(0);
  });
});
