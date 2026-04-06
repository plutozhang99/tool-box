import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, closeDatabase } from '../../src/local/database.js';
import { registerSession, listSessions } from '../../src/local/session-registry.js';
import {
  sendMessage,
  readMessages,
  broadcastMessage,
} from '../../src/local/message-bus.js';
import type Database from 'better-sqlite3';

describe('local multi-session flow', () => {
  let tempDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nexus-integration-'));
    db = createDatabase(join(tempDir, 'test.db'));
  });

  afterEach(() => {
    closeDatabase(db);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('simulates CTO coordinating frontend and backend', () => {
    // 1. Three sessions register
    const cto = registerSession(db, 'cto', 'Tech Lead');
    const fe = registerSession(db, 'frontend', 'FE Developer');
    const be = registerSession(db, 'backend', 'BE Developer');

    // 2. CTO broadcasts task assignment
    const broadcast = broadcastMessage(
      db,
      tempDir,
      cto.id,
      'Sprint goal: Implement user authentication. FE: login page, BE: auth API.',
    );
    expect(broadcast).toHaveLength(2);

    // 3. Frontend reads its messages
    const feMessages = readMessages(db, fe.id, 10, true);
    expect(feMessages).toHaveLength(1);
    expect(feMessages[0]!.content).toContain('user authentication');

    // 4. Frontend asks Backend a question
    const question = sendMessage(db, tempDir, fe.id, {
      toRole: 'backend',
      content: 'What will the auth API endpoint look like? POST /api/auth/login?',
      messageType: 'request',
    });

    // 5. Backend reads and replies
    const beMessages = readMessages(db, be.id, 10, true);
    expect(beMessages).toHaveLength(2); // broadcast + question
    const feQuestion = beMessages.find((m) => m.message_type === 'request');
    expect(feQuestion).toBeDefined();

    const reply = sendMessage(db, tempDir, be.id, {
      toSessionId: fe.id,
      content: 'Yes, POST /api/auth/login with { email, password }. Returns JWT token.',
      messageType: 'response',
      inReplyTo: feQuestion!.id,
    });

    // 6. Frontend reads the reply
    const feReplies = readMessages(db, fe.id, 10, true);
    expect(feReplies).toHaveLength(1);
    expect(feReplies[0]!.in_reply_to).toBe(feQuestion!.id);
    expect(feReplies[0]!.content).toContain('JWT token');
  });

  it('handles role-based discovery', () => {
    registerSession(db, 'frontend', 'FE-1');
    registerSession(db, 'frontend', 'FE-2');
    registerSession(db, 'backend', 'BE-1');
    registerSession(db, 'cto', 'CTO');

    expect(listSessions(db, 'frontend')).toHaveLength(2);
    expect(listSessions(db, 'backend')).toHaveLength(1);
    expect(listSessions(db, 'cto')).toHaveLength(1);
    expect(listSessions(db)).toHaveLength(4);
  });

  it('delivers messages when recipient was offline then comes online', () => {
    const sender = registerSession(db, 'cto');
    const receiver = registerSession(db, 'backend');

    // Send messages while "offline" (not reading)
    sendMessage(db, tempDir, sender.id, {
      toSessionId: receiver.id,
      content: 'Message 1',
    });
    sendMessage(db, tempDir, sender.id, {
      toSessionId: receiver.id,
      content: 'Message 2',
    });
    sendMessage(db, tempDir, sender.id, {
      toSessionId: receiver.id,
      content: 'Message 3',
    });

    // Receiver "comes online" and reads all
    const messages = readMessages(db, receiver.id, 10, true);
    expect(messages).toHaveLength(3);
    expect(messages.map((m) => m.content)).toEqual([
      'Message 1',
      'Message 2',
      'Message 3',
    ]);

    // No more unread
    const again = readMessages(db, receiver.id, 10, false);
    expect(again).toHaveLength(0);
  });
});
