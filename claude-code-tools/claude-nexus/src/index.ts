#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { join } from 'node:path';
import { loadConfig } from './config.js';
import { createDatabase } from './local/database.js';
import {
  registerSession,
  listSessions,
  heartbeat,
  pruneStale,
} from './local/session-registry.js';
import {
  sendMessage,
  broadcastMessage,
  readMessages,
  findOrphanMessages,
  deleteOrphanMessages,
} from './local/message-bus.js';
import { watchForNotifications } from './local/notifier.js';
import { getOrCreateIdentity, publicKeyToBase64 } from './remote/identity.js';
import { RelayClient } from './remote/relay-client.js';
import { RemoteBus } from './remote/remote-bus.js';
import { setupCleanup } from './utils/cleanup.js';
import { logger, setSessionContext } from './utils/logger.js';
import { MAX_CONTENT_LENGTH, MAX_ROLE_LENGTH, MAX_DISPLAY_NAME_LENGTH } from './types.js';
import type { MessageType, Session, OrphanSummary } from './types.js';

// --- State ---
const config = loadConfig();
const db = createDatabase(join(config.dataDir, 'nexus.db'));

let currentSessionId: string | null = null;
let currentSessionRole: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let cleanupNotifier: (() => void) | null = null;
let relayClient: RelayClient | null = null;
let remoteBus: RemoteBus | null = null;

// HIGH-6: Concurrency guard for registration
let registering = false;

// --- MCP Server ---
const server = new McpServer(
  { name: 'claude-nexus', version: '1.0.0' },
  { capabilities: { logging: {} } },
);

// ===== TOOL: nexus_register =====
server.tool(
  'nexus_register',
  'Register this Claude Code session with the Nexus. Must be called first. Assigns a role (cto, frontend, backend, or custom) so other sessions can discover and message this one.',
  {
    role: z.string().min(1).max(MAX_ROLE_LENGTH).describe('Session role: cto, frontend, backend, or any custom role'),
    display_name: z.string().max(MAX_DISPLAY_NAME_LENGTH).optional().describe('Human-readable name for this session'),
  },
  async ({ role, display_name }) => {
    // HIGH-6: Guard against concurrent registration
    if (currentSessionId || registering) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: currentSessionId ? 'Session already registered' : 'Registration in progress',
              session_id: currentSessionId,
              role: currentSessionRole,
            }),
          },
        ],
      };
    }

    registering = true;
    try {
      const session = registerSession(db, role, display_name);
      currentSessionId = session.id;
      currentSessionRole = role;
      setSessionContext(session.id);

      // Start heartbeat (message cleanup is manual via nexus_cleanup)
      heartbeatTimer = setInterval(() => {
        if (currentSessionId) {
          heartbeat(db, currentSessionId);
          pruneStale(db, config.staleSessionTimeout);
        }
      }, config.heartbeatInterval);

      // Setup cleanup on exit (enforces single-call internally)
      setupCleanup(db, session.id);

      // Watch for notifications
      cleanupNotifier = watchForNotifications(
        config.dataDir,
        session.id,
        () => {
          logger.debug('Notification received');
        },
        config.notifyDebounceMs,
      );

      // Check for orphan messages from previous sessions
      const orphans = findOrphanMessages(db);

      const result: {
        status: string;
        session: Session;
        message: string;
        orphan_messages?: OrphanSummary;
        warning?: string;
      } = {
        status: 'registered',
        session,
        message: `Session registered as "${role}"${display_name ? ` (${display_name})` : ''}. You can now send/receive messages.`,
      };

      if (orphans.count > 0) {
        result.orphan_messages = orphans;
        result.warning =
          `Found ${orphans.count} unread message(s) from ${orphans.sources.length} expired session(s). ` +
          'These are leftover from previous sessions. ' +
          'Use nexus_read to review them, or nexus_cleanup to delete them.';
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    } finally {
      registering = false;
    }
  },
);

// ===== TOOL: nexus_list_sessions =====
server.tool(
  'nexus_list_sessions',
  'List all active Claude Code sessions connected to the Nexus. Optionally filter by role. Shows session IDs, roles, and display names for message targeting.',
  {
    role_filter: z.string().max(MAX_ROLE_LENGTH).optional().describe('Filter by role (e.g., "frontend", "backend", "cto")'),
  },
  async ({ role_filter }) => {
    pruneStale(db, config.staleSessionTimeout);
    const sessions = listSessions(db, role_filter);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            sessions,
            count: sessions.length,
            current_session_id: currentSessionId,
          }),
        },
      ],
    };
  },
);

// ===== TOOL: nexus_send =====
server.tool(
  'nexus_send',
  'Send a message to another session by session ID or role. Use to_role to message all sessions with that role (e.g., "backend"). Use to_session_id for direct messages. Supports request/response threading via in_reply_to.',
  {
    to_session_id: z.string().uuid().optional().describe('Target session ID for direct message'),
    to_role: z.string().max(MAX_ROLE_LENGTH).optional().describe('Target role (sends to all sessions with this role)'),
    content: z.string().max(MAX_CONTENT_LENGTH).describe('Message content'),
    message_type: z
      .enum(['chat', 'request', 'response'])
      .default('chat')
      .describe('Message type: chat (general), request (asking a question), response (answering)'),
    in_reply_to: z.string().uuid().optional().describe('Message ID this is replying to'),
  },
  async ({ to_session_id, to_role, content, message_type, in_reply_to }) => {
    if (!currentSessionId) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Not registered. Call nexus_register first.' }) }],
      };
    }

    if (!to_session_id && !to_role) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Provide to_session_id or to_role.' }) }],
      };
    }

    const sent = sendMessage(db, config.dataDir, currentSessionId, {
      toSessionId: to_session_id,
      toRole: to_role,
      content,
      messageType: message_type as MessageType,
      inReplyTo: in_reply_to,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            status: 'sent',
            messages_sent: sent.length,
            messages: sent,
          }),
        },
      ],
    };
  },
);

// ===== TOOL: nexus_read =====
server.tool(
  'nexus_read',
  'Read unread messages sent to this session. Returns messages addressed to this session ID or role. Messages are marked as read by default. Role-addressed messages use broadcast semantics — multiple sessions with the same role each receive their own copy.',
  {
    limit: z.number().int().positive().default(20).describe('Max messages to return'),
    mark_read: z.boolean().default(true).describe('Mark returned messages as read'),
  },
  async ({ limit, mark_read }) => {
    if (!currentSessionId) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Not registered. Call nexus_register first.' }) }],
      };
    }

    const messages = readMessages(db, currentSessionId, limit, mark_read);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            messages,
            count: messages.length,
            session_id: currentSessionId,
          }),
        },
      ],
    };
  },
);

// ===== TOOL: nexus_broadcast =====
server.tool(
  'nexus_broadcast',
  'Broadcast a message to all active sessions, or to all sessions of a specific role. Useful for CTO announcements or team-wide updates.',
  {
    content: z.string().max(MAX_CONTENT_LENGTH).describe('Message content to broadcast'),
    to_role: z.string().max(MAX_ROLE_LENGTH).optional().describe('Broadcast only to sessions with this role'),
  },
  async ({ content, to_role }) => {
    if (!currentSessionId) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Not registered. Call nexus_register first.' }) }],
      };
    }

    const sent = broadcastMessage(db, config.dataDir, currentSessionId, content, to_role);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            status: 'broadcast',
            recipients: sent.length,
            messages: sent,
          }),
        },
      ],
    };
  },
);

// ===== TOOL: nexus_status =====
server.tool(
  'nexus_status',
  'Show database status: active sessions, message counts (total, unread, orphan), database file size, and oldest message age. Useful for monitoring data accumulation.',
  {},
  async () => {
    const dbPath = join(config.dataDir, 'nexus.db');
    const { size: dbSizeBytes } = await import('node:fs').then((fs) => fs.statSync(dbPath));

    const counts = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unread,
           MIN(created_at) AS oldest
         FROM messages`,
      )
      .get() as { total: number; unread: number; oldest: string | null };

    const orphanCount = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM messages m
         LEFT JOIN sessions s ON m.from_session_id = s.id
         WHERE m.read_at IS NULL AND s.id IS NULL`,
      )
      .get() as { cnt: number };

    const sessionCount = db
      .prepare('SELECT COUNT(*) AS cnt FROM sessions')
      .get() as { cnt: number };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            database_size_kb: Math.round(dbSizeBytes / 1024),
            active_sessions: sessionCount.cnt,
            messages: {
              total: counts.total,
              unread: counts.unread,
              orphan: orphanCount.cnt,
              read: counts.total - counts.unread,
            },
            oldest_message: counts.oldest,
          }),
        },
      ],
    };
  },
);

// ===== TOOL: nexus_cleanup =====
server.tool(
  'nexus_cleanup',
  'Delete orphan messages left by expired sessions. These are unread messages whose sender session no longer exists. Call this after reviewing orphan messages reported during nexus_register.',
  {},
  async () => {
    if (!currentSessionId) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Not registered. Call nexus_register first.' }) }],
      };
    }

    const orphans = findOrphanMessages(db);
    if (orphans.count === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ status: 'clean', message: 'No orphan messages found.' }) }],
      };
    }

    const deleted = deleteOrphanMessages(db);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            status: 'cleaned',
            orphan_messages_deleted: deleted,
            message: `Deleted ${deleted} orphan message(s) from expired sessions.`,
          }),
        },
      ],
    };
  },
);

// ===== TOOL: nexus_remote_connect =====
server.tool(
  'nexus_remote_connect',
  'Connect to a remote relay server for cross-machine communication. Generates or loads an Ed25519 identity keypair. Returns your peer ID and box public key for sharing with remote peers.',
  {
    relay_url: z.string().url().describe('WebSocket relay server URL (e.g., wss://relay.example.com)'),
  },
  async ({ relay_url }) => {
    if (relayClient?.isConnected) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: 'already_connected',
              peer_id: remoteBus ? 'connected' : 'unknown',
            }),
          },
        ],
      };
    }

    const identity = getOrCreateIdentity(config.dataDir);
    relayClient = new RelayClient({
      relayUrl: relay_url,
      identity,
    });

    try {
      await relayClient.connect();
      remoteBus = new RemoteBus(relayClient, identity);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: 'connected',
              peer_id: identity.peerId,
              public_key: publicKeyToBase64(identity.publicKey),
              box_public_key: publicKeyToBase64(identity.boxPublicKey),
              relay_url,
              message: 'Connected to relay. Share your peer_id and box_public_key with remote peers for encrypted communication.',
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: 'error',
              error: `Failed to connect: ${String(err)}`,
            }),
          },
        ],
      };
    }
  },
);

// ===== TOOL: nexus_remote_send =====
server.tool(
  'nexus_remote_send',
  'Send an end-to-end encrypted message to a remote peer via the relay server. Requires the remote peer\'s ID and box_public_key. The relay server cannot read the message content.',
  {
    to_peer_id: z.string().describe('Remote peer ID'),
    to_peer_public_key: z.string().describe('Remote peer box_public_key for encryption (base64, from nexus_remote_connect)'),
    content: z.string().max(MAX_CONTENT_LENGTH).describe('Message content (will be encrypted)'),
  },
  async ({ to_peer_id, to_peer_public_key, content }) => {
    if (!remoteBus) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: 'Not connected to relay. Call nexus_remote_connect first.' }),
          },
        ],
      };
    }

    try {
      await remoteBus.sendRemoteMessage(to_peer_id, to_peer_public_key, content);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              status: 'sent',
              to_peer_id,
              encrypted: true,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Failed to send: ${String(err)}` }),
          },
        ],
      };
    }
  },
);

// ===== TOOL: nexus_remote_read =====
server.tool(
  'nexus_remote_read',
  'Read messages received from remote peers. Messages are automatically decrypted if the sender\'s public key is known.',
  {
    limit: z.number().int().positive().default(20).describe('Max messages to return'),
  },
  async ({ limit }) => {
    if (!remoteBus) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: 'Not connected to relay. Call nexus_remote_connect first.' }),
          },
        ],
      };
    }

    const messages = remoteBus.readRemoteMessages(limit);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            messages,
            count: messages.length,
          }),
        },
      ],
    };
  },
);

// --- Start Server ---
async function main(): Promise<void> {
  logger.info('Starting claude-nexus MCP server');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('claude-nexus MCP server running');
}

main().catch((err) => {
  logger.error('Failed to start server', { error: String(err) });
  process.exit(1);
});
