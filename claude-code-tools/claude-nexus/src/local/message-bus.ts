import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Message, MessageType } from '../types.js';
import { MessageTypeSchema } from '../types.js';
import { notifySession } from './notifier.js';
import { listSessions, getSession } from './session-registry.js';
import { logger } from '../utils/logger.js';

export interface SendMessageOptions {
  readonly toSessionId?: string;
  readonly toRole?: string;
  readonly content: string;
  readonly messageType?: MessageType; // HIGH-5: Use typed union, not string
  readonly inReplyTo?: string;
}

export function sendMessage(
  db: Database.Database,
  dataDir: string,
  fromSessionId: string,
  options: SendMessageOptions,
): readonly Message[] {
  const { toSessionId, toRole, content, messageType = 'chat', inReplyTo } = options;

  if (!toSessionId && !toRole) {
    throw new Error('Either to_session_id or to_role must be provided');
  }

  // HIGH-5: Validate messageType at runtime
  const parsedType = MessageTypeSchema.parse(messageType);

  const sent: Message[] = [];

  if (toSessionId) {
    const msg = insertMessage(db, fromSessionId, toSessionId, null, content, parsedType, inReplyTo);
    sent.push(msg);
    // MED-12: Notify AFTER the insert (not inside a transaction)
    notifySession(dataDir, toSessionId);
  } else if (toRole) {
    const targets = listSessions(db, toRole);
    // MED-12: Collect recipients, do DB inserts in transaction, notify after commit
    const recipientIds: string[] = [];
    const insert = db.transaction(() => {
      for (const target of targets) {
        if (target.id === fromSessionId) continue;
        const msg = insertMessage(db, fromSessionId, target.id, toRole, content, parsedType, inReplyTo);
        sent.push(msg);
        recipientIds.push(target.id);
      }
    });
    insert();
    // Notify after transaction commits
    for (const recipientId of recipientIds) {
      notifySession(dataDir, recipientId);
    }
  }

  logger.debug(`Sent ${sent.length} message(s)`, { fromSessionId, toSessionId, toRole });
  return sent;
}

export function broadcastMessage(
  db: Database.Database,
  dataDir: string,
  fromSessionId: string,
  content: string,
  toRole?: string,
): readonly Message[] {
  const targets = toRole ? listSessions(db, toRole) : listSessions(db);
  const sent: Message[] = [];
  const recipientIds: string[] = [];

  // MED-12: Collect recipients, insert in transaction, notify after commit
  const insert = db.transaction(() => {
    for (const target of targets) {
      if (target.id === fromSessionId) continue;
      const msg = insertMessage(
        db,
        fromSessionId,
        target.id,
        toRole ?? null,
        content,
        'chat',
        undefined,
      );
      sent.push(msg);
      recipientIds.push(target.id);
    }
  });
  insert();

  for (const recipientId of recipientIds) {
    notifySession(dataDir, recipientId);
  }

  logger.debug(`Broadcast ${sent.length} message(s)`, { fromSessionId, toRole });
  return sent;
}

export function readMessages(
  db: Database.Database,
  sessionId: string,
  limit: number = 20,
  markRead: boolean = true,
): readonly Message[] {
  const session = getSession(db, sessionId);
  if (!session) return [];

  const messages = db
    .prepare(
      `SELECT * FROM messages
       WHERE read_at IS NULL
         AND (to_session_id = ? OR to_role = ?)
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(sessionId, session.role, limit) as Message[];

  if (markRead && messages.length > 0) {
    const now = new Date().toISOString();
    const update = db.prepare('UPDATE messages SET read_at = ? WHERE id = ?');
    const markAll = db.transaction(() => {
      for (const msg of messages) {
        update.run(now, msg.id);
      }
    });
    markAll();
  }

  return messages;
}

export function purgeOldMessages(db: Database.Database, ttlMs: number): number {
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const result = db.prepare('DELETE FROM messages WHERE created_at < ?').run(cutoff);
  return result.changes;
}

function insertMessage(
  db: Database.Database,
  fromSessionId: string,
  toSessionId: string | null,
  toRole: string | null,
  content: string,
  messageType: MessageType, // HIGH-5: Typed parameter, no unsafe cast
  inReplyTo?: string,
): Message {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO messages (id, from_session_id, to_session_id, to_role, content, message_type, in_reply_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, fromSessionId, toSessionId, toRole, content, messageType, inReplyTo ?? null, now);

  return {
    id,
    from_session_id: fromSessionId,
    to_session_id: toSessionId,
    to_role: toRole,
    content,
    message_type: messageType,
    in_reply_to: inReplyTo ?? null,
    created_at: now,
    read_at: null,
  };
}
