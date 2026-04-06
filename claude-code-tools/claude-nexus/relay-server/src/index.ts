#!/usr/bin/env node

import { WebSocketServer, WebSocket } from 'ws';
import { generateNonce, verifyAuth, derivePeerIdFromPublicKey } from './auth.js';
import { MessageStore } from './store.js';
import type {
  ConnectedPeer,
  OutgoingMessage,
  RelayMessage,
} from './types.js';

function parseIntSafe(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const PORT = parseIntSafe(process.env['RELAY_PORT'], 3001);
const MESSAGE_TTL = parseIntSafe(process.env['RELAY_MESSAGE_TTL'], 86400000);
const MAX_MESSAGES_PER_MIN = parseIntSafe(process.env['RELAY_RATE_LIMIT'], 100);
const MAX_PENDING_AUTH = parseIntSafe(process.env['RELAY_MAX_PENDING_AUTH'], 200);
const MAX_WS_PAYLOAD = parseIntSafe(process.env['RELAY_MAX_PAYLOAD'], 65536);

// --- State ---
const peers: Map<string, ConnectedPeer> = new Map();
const wsToPeerId: Map<WebSocket, string> = new Map(); // CRIT-1: ws->peerId mapping
const pendingAuth: Map<WebSocket, { nonce: string; createdAt: number }> = new Map();
const rateLimits: Map<string, { count: number; resetAt: number }> = new Map();
const store = new MessageStore(MESSAGE_TTL);

// --- Prune timer ---
setInterval(() => {
  const pruned = store.prune();
  if (pruned > 0) {
    process.stderr.write(`[relay] Pruned ${pruned} expired queued messages\n`);
  }
}, 60000);

// --- Rate limiter (immutable update) ---
function checkRateLimit(peerId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(peerId);
  if (!entry || now >= entry.resetAt) {
    rateLimits.set(peerId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  const newCount = entry.count + 1;
  rateLimits.set(peerId, { count: newCount, resetAt: entry.resetAt });
  return newCount <= MAX_MESSAGES_PER_MIN;
}

// --- WebSocket Server ---
const wss = new WebSocketServer({
  port: PORT,
  maxPayload: MAX_WS_PAYLOAD, // HIGH-1: limit message size
});

process.stderr.write(`[relay] Claude Nexus relay server listening on port ${PORT}\n`);
process.stderr.write(`[relay] Message TTL: ${MESSAGE_TTL}ms, Rate limit: ${MAX_MESSAGES_PER_MIN}/min, Max payload: ${MAX_WS_PAYLOAD}B\n`);

wss.on('connection', (ws) => {
  // HIGH-3: reject if too many unauthenticated connections
  if (pendingAuth.size >= MAX_PENDING_AUTH) {
    sendToWs(ws, { type: 'error', message: 'Server busy' });
    ws.close();
    return;
  }

  // Send auth challenge
  const nonce = generateNonce();
  pendingAuth.set(ws, { nonce, createdAt: Date.now() });
  sendToWs(ws, { type: 'challenge', nonce });

  // Auth timeout: 10 seconds
  const authTimeout = setTimeout(() => {
    if (pendingAuth.has(ws)) {
      sendToWs(ws, { type: 'error', message: 'Authentication timeout' });
      ws.close();
      pendingAuth.delete(ws);
    }
  }, 10000);

  ws.on('message', (data) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data.toString()) as Record<string, unknown>;
    } catch {
      sendToWs(ws, { type: 'error', message: 'Invalid message' });
      return;
    }

    const msgType = msg['type'];

    // Handle auth
    if (msgType === 'auth') {
      const pending = pendingAuth.get(ws);
      if (!pending) {
        sendToWs(ws, { type: 'error', message: 'Unexpected message' });
        return;
      }

      const peerIdClaimed = typeof msg['peer_id'] === 'string' ? msg['peer_id'] : '';
      const publicKey = typeof msg['public_key'] === 'string' ? msg['public_key'] : '';
      const signature = typeof msg['signature'] === 'string' ? msg['signature'] : '';

      if (!peerIdClaimed || !publicKey || !signature) {
        sendToWs(ws, { type: 'error', message: 'Invalid auth fields' });
        ws.close();
        pendingAuth.delete(ws);
        clearTimeout(authTimeout);
        return;
      }

      const valid = verifyAuth(publicKey, pending.nonce, signature);
      if (!valid) {
        sendToWs(ws, { type: 'error', message: 'Authentication failed' });
        ws.close();
        pendingAuth.delete(ws);
        clearTimeout(authTimeout);
        return;
      }

      // CRIT-2: Derive peerId from public_key on server side, reject mismatch
      const expectedPeerId = derivePeerIdFromPublicKey(publicKey);
      if (peerIdClaimed !== expectedPeerId) {
        sendToWs(ws, { type: 'error', message: 'Peer ID mismatch' });
        ws.close();
        pendingAuth.delete(ws);
        clearTimeout(authTimeout);
        return;
      }

      pendingAuth.delete(ws);
      clearTimeout(authTimeout);

      const peerId = expectedPeerId;

      // Disconnect existing connection for same peer
      const existing = peers.get(peerId);
      if (existing) {
        process.stderr.write(`[relay] Replacing existing connection for ${peerId}\n`);
        // Clean up old ws->peerId mapping
        for (const [oldWs, oldId] of wsToPeerId) {
          if (oldId === peerId) {
            wsToPeerId.delete(oldWs);
            break;
          }
        }
      }

      const peer: ConnectedPeer = {
        peerId,
        publicKey,
        connectedAt: new Date().toISOString(),
        send: (outMsg: OutgoingMessage) => sendToWs(ws, outMsg),
      };
      peers.set(peerId, peer);
      wsToPeerId.set(ws, peerId); // CRIT-1: track ws->peerId

      process.stderr.write(`[relay] Peer authenticated: ${peerId}\n`);
      sendToWs(ws, { type: 'ack', message_id: 'auth' });

      // Flush queued messages
      const queued = store.dequeue(peerId);
      for (const queuedMsg of queued) {
        peer.send(queuedMsg);
      }
      if (queued.length > 0) {
        process.stderr.write(`[relay] Flushed ${queued.length} queued message(s) to ${peerId}\n`);
      }

      return;
    }

    // Handle relay messages
    if (msgType === 'relay') {
      // CRIT-1: Use server-verified identity, not client-supplied 'from'
      const senderPeerId = wsToPeerId.get(ws);
      if (!senderPeerId) {
        sendToWs(ws, { type: 'error', message: 'Not authenticated' });
        return;
      }

      // Validate relay message fields
      const to = typeof msg['to'] === 'string' ? msg['to'] : '';
      const payload = msg['payload'];
      if (!to || !payload || typeof payload !== 'object') {
        sendToWs(ws, { type: 'error', message: 'Invalid relay message' });
        return;
      }

      const payloadObj = payload as Record<string, unknown>;
      if (typeof payloadObj['nonce'] !== 'string' || typeof payloadObj['ciphertext'] !== 'string') {
        sendToWs(ws, { type: 'error', message: 'Invalid relay payload' });
        return;
      }

      if (!checkRateLimit(senderPeerId)) {
        sendToWs(ws, { type: 'error', message: 'Rate limit exceeded' });
        return;
      }

      // Build canonical relay message with server-verified 'from'
      const relayMsg: RelayMessage = {
        type: 'relay',
        from: senderPeerId, // CRIT-1: server sets 'from', not client
        to,
        payload: {
          nonce: payloadObj['nonce'] as string,
          ciphertext: payloadObj['ciphertext'] as string,
        },
      };

      const targetPeer = peers.get(to);
      if (targetPeer) {
        targetPeer.send(relayMsg);
        sendToWs(ws, { type: 'ack' });
      } else {
        const messageId = store.enqueue(to, relayMsg, senderPeerId);
        sendToWs(ws, {
          type: 'queued',
          message_id: messageId,
          to,
        });
        process.stderr.write(`[relay] Queued message for offline peer ${to}\n`);
      }
    }
  });

  ws.on('close', () => {
    pendingAuth.delete(ws);
    clearTimeout(authTimeout);

    // MED-2: Use ws->peerId mapping for O(1) correct removal
    const peerId = wsToPeerId.get(ws);
    if (peerId) {
      peers.delete(peerId);
      wsToPeerId.delete(ws);
      process.stderr.write(`[relay] Peer disconnected: ${peerId}\n`);
    }
  });

  ws.on('error', (err) => {
    process.stderr.write(`[relay] WebSocket error: ${err.message}\n`);
  });
});

// --- Heartbeat: use WebSocket ping/pong instead of application-level ack (MED-6) ---
setInterval(() => {
  for (const [ws, peerId] of wsToPeerId) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      peers.delete(peerId);
      wsToPeerId.delete(ws);
      process.stderr.write(`[relay] Removed dead peer: ${peerId}\n`);
    }
  }
}, 30000);

function sendToWs(ws: WebSocket, msg: OutgoingMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  process.stderr.write('[relay] Shutting down...\n');
  wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.stderr.write('[relay] Shutting down...\n');
  wss.close();
  process.exit(0);
});
