import { z } from 'zod';

// --- Constants ---
export const MAX_CONTENT_LENGTH = 65536;
export const MAX_ROLE_LENGTH = 64;
export const MAX_DISPLAY_NAME_LENGTH = 128;

// --- Roles ---
export const BUILT_IN_ROLES = ['cto', 'frontend', 'backend'] as const;
export type BuiltInRole = (typeof BUILT_IN_ROLES)[number];

// MED-4: Add max length to role
export const RoleSchema = z.string().min(1).max(MAX_ROLE_LENGTH).describe('Session role (cto, frontend, backend, or custom)');
export type Role = z.infer<typeof RoleSchema>;

// --- Session ---
export const SessionSchema = z.object({
  id: z.string().uuid(),
  role: RoleSchema,
  display_name: z.string().nullable(),
  pid: z.number().int(),
  registered_at: z.string(),
  last_heartbeat: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

// --- Message ---
export const MessageTypeSchema = z.enum(['chat', 'request', 'response']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  from_session_id: z.string(),
  to_session_id: z.string().nullable(),
  to_role: z.string().nullable(),
  content: z.string(),
  message_type: MessageTypeSchema,
  in_reply_to: z.string().nullable(),
  created_at: z.string(),
  read_at: z.string().nullable(),
});
export type Message = z.infer<typeof MessageSchema>;

// --- Tool Input Schemas ---
export const RegisterSessionInputSchema = z.object({
  role: RoleSchema,
  display_name: z.string().max(MAX_DISPLAY_NAME_LENGTH).optional().describe('Human-readable name for this session'),
});

export const ListSessionsInputSchema = z.object({
  role_filter: z.string().max(MAX_ROLE_LENGTH).optional().describe('Filter sessions by role'),
});

export const SendMessageInputSchema = z.object({
  to_session_id: z.string().optional().describe('Target session ID (direct message)'),
  to_role: z.string().max(MAX_ROLE_LENGTH).optional().describe('Target role (sends to all sessions with this role)'),
  content: z.string().max(MAX_CONTENT_LENGTH).describe('Message content'),
  message_type: MessageTypeSchema.default('chat').describe('Message type'),
  in_reply_to: z.string().optional().describe('Message ID this replies to'),
});

export const ReadMessagesInputSchema = z.object({
  limit: z.number().int().positive().default(20).describe('Max messages to return'),
  mark_read: z.boolean().default(true).describe('Mark messages as read'),
});

export const BroadcastInputSchema = z.object({
  content: z.string().max(MAX_CONTENT_LENGTH).describe('Message content'),
  to_role: z.string().max(MAX_ROLE_LENGTH).optional().describe('Broadcast to specific role only'),
});

export const ConnectRemoteInputSchema = z.object({
  relay_url: z.string().url().describe('WebSocket relay server URL'),
});

export const RemoteSendInputSchema = z.object({
  to_peer_id: z.string().describe('Remote peer ID'),
  to_peer_public_key: z.string().describe('Remote peer public key (base64)'),
  content: z.string().max(MAX_CONTENT_LENGTH).describe('Message content'),
});

export const RemoteReadInputSchema = z.object({
  limit: z.number().int().positive().default(20).describe('Max messages to return'),
});

// --- Remote Protocol Types ---
export const RelayMessageTypeSchema = z.enum([
  'challenge',
  'auth',
  'relay',
  'ack',
  'error',
  'queued',
]);

export const AuthChallengeSchema = z.object({
  type: z.literal('challenge'),
  nonce: z.string().min(16),
});

export const AuthResponseSchema = z.object({
  type: z.literal('auth'),
  peer_id: z.string(),
  signature: z.string(),
  public_key: z.string(),
});

export const RelayPayloadSchema = z.object({
  nonce: z.string(),
  ciphertext: z.string(),
});

export const RelayMessageSchema = z.object({
  type: z.literal('relay'),
  from: z.string(),
  to: z.string(),
  payload: RelayPayloadSchema,
  message_id: z.string().optional(),
});

export const AckSchema = z.object({
  type: z.literal('ack'),
  message_id: z.string().optional(),
});

export const RelayErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const QueuedNoticeSchema = z.object({
  type: z.literal('queued'),
  message_id: z.string(),
  to: z.string(),
});

// Discriminated union for incoming relay client messages
export const IncomingRelayMessageSchema = z.discriminatedUnion('type', [
  AuthChallengeSchema,
  AckSchema,
  RelayMessageSchema,
  RelayErrorSchema,
  QueuedNoticeSchema,
]);

// --- Config ---
export interface NexusConfig {
  readonly dataDir: string;
  readonly heartbeatInterval: number;
  readonly messageTtl: number;
  readonly relayUrl: string | null;
  readonly staleSessionTimeout: number;
  readonly notifyDebounceMs: number;
}
