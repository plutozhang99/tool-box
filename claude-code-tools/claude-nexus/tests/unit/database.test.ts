import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, closeDatabase } from '../../src/local/database.js';
import type Database from 'better-sqlite3';

describe('database', () => {
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

  it('creates sessions table', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('creates messages table', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('uses WAL journal mode', () => {
    const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
    expect(result[0]?.journal_mode).toBe('wal');
  });

  it('is idempotent on re-create', () => {
    closeDatabase(db);
    const db2 = createDatabase(join(tempDir, 'test.db'));
    const tables = db2
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all();
    expect(tables.length).toBeGreaterThanOrEqual(2);
    closeDatabase(db2);
  });
});
