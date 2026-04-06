import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, closeDatabase } from '../../src/local/database.js';
import { registerSession } from '../../src/local/session-registry.js';
import {
  sendMessage,
  readMessages,
  broadcastMessage,
  purgeOldMessages,
} from '../../src/local/message-bus.js';
import type Database from 'better-sqlite3';

describe('message-bus', () => {
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

  it('sends a direct message', () => {
    const sender = registerSession(db, 'cto');
    const receiver = registerSession(db, 'frontend');

    const sent = sendMessage(db, tempDir, sender.id, {
      toSessionId: receiver.id,
      content: 'Please fix the login page',
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.content).toBe('Please fix the login page');
    expect(sent[0]!.from_session_id).toBe(sender.id);
    expect(sent[0]!.to_session_id).toBe(receiver.id);
  });

  it('sends to a role', () => {
    const cto = registerSession(db, 'cto');
    const fe1 = registerSession(db, 'frontend');
    const fe2 = registerSession(db, 'frontend');

    const sent = sendMessage(db, tempDir, cto.id, {
      toRole: 'frontend',
      content: 'Deploy to staging',
    });

    expect(sent).toHaveLength(2);
  });

  it('reads unread messages', () => {
    const sender = registerSession(db, 'backend');
    const receiver = registerSession(db, 'frontend');

    sendMessage(db, tempDir, sender.id, {
      toSessionId: receiver.id,
      content: 'API ready',
    });
    sendMessage(db, tempDir, sender.id, {
      toSessionId: receiver.id,
      content: 'Docs updated',
    });

    const messages = readMessages(db, receiver.id, 10, false);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.content).toBe('API ready');
  });

  it('marks messages as read', () => {
    const sender = registerSession(db, 'cto');
    const receiver = registerSession(db, 'backend');

    sendMessage(db, tempDir, sender.id, {
      toSessionId: receiver.id,
      content: 'Status update?',
    });

    readMessages(db, receiver.id, 10, true);
    const unread = readMessages(db, receiver.id, 10, false);
    expect(unread).toHaveLength(0);
  });

  it('broadcasts to all', () => {
    const cto = registerSession(db, 'cto');
    const fe = registerSession(db, 'frontend');
    const be = registerSession(db, 'backend');

    const sent = broadcastMessage(db, tempDir, cto.id, 'Team standup in 5');
    expect(sent).toHaveLength(2); // Excludes sender
  });

  it('broadcasts to specific role', () => {
    const cto = registerSession(db, 'cto');
    const fe = registerSession(db, 'frontend');
    const be = registerSession(db, 'backend');

    const sent = broadcastMessage(db, tempDir, cto.id, 'Backend focus today', 'backend');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to_session_id).toBe(be.id);
  });

  it('supports request/response threading', () => {
    const fe = registerSession(db, 'frontend');
    const be = registerSession(db, 'backend');

    const question = sendMessage(db, tempDir, fe.id, {
      toSessionId: be.id,
      content: 'What format is the /api/users response?',
      messageType: 'request',
    });

    const answer = sendMessage(db, tempDir, be.id, {
      toSessionId: fe.id,
      content: 'JSON array of user objects',
      messageType: 'response',
      inReplyTo: question[0]!.id,
    });

    expect(answer[0]!.in_reply_to).toBe(question[0]!.id);
    expect(answer[0]!.message_type).toBe('response');
  });

  it('purges old messages', () => {
    const sender = registerSession(db, 'cto');
    const receiver = registerSession(db, 'backend');

    sendMessage(db, tempDir, sender.id, {
      toSessionId: receiver.id,
      content: 'Old message',
    });

    // Set message to 2 days ago
    db.prepare("UPDATE messages SET created_at = datetime('now', '-2 days')").run();

    const purged = purgeOldMessages(db, 86400000); // 24h
    expect(purged).toBe(1);
  });

  it('throws when neither to_session_id nor to_role provided', () => {
    const sender = registerSession(db, 'cto');
    expect(() =>
      sendMessage(db, tempDir, sender.id, { content: 'hello' }),
    ).toThrow('Either to_session_id or to_role must be provided');
  });
});
