import WebSocket from 'ws';
import type { Identity } from './identity.js';
import { signChallenge, publicKeyToBase64 } from './identity.js';
import type { EncryptedPayload } from './encryption.js';
import {
  AuthChallengeSchema,
  AckSchema,
  RelayMessageSchema,
  RelayErrorSchema,
} from '../types.js';
import { logger } from '../utils/logger.js';

export type RelayMessageHandler = (from: string, payload: EncryptedPayload) => void;

interface RelayClientOptions {
  readonly relayUrl: string;
  readonly identity: Identity;
  readonly onMessage?: RelayMessageHandler;
  readonly maxReconnectDelay?: number;
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private readonly relayUrl: string;
  private readonly identity: Identity;
  private onMessageHandler: RelayMessageHandler | null;
  private readonly maxReconnectDelay: number;
  private reconnectDelay: number = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected: boolean = false;
  private authenticated: boolean = false;
  private shouldReconnect: boolean = true;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;

  constructor(options: RelayClientOptions) {
    this.relayUrl = options.relayUrl;
    this.identity = options.identity;
    this.onMessageHandler = options.onMessage ?? null;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.shouldReconnect = true;
      this.doConnect();
    });
  }

  private doConnect(): void {
    try {
      this.ws = new WebSocket(this.relayUrl);
    } catch (err) {
      this.connectReject?.(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      logger.info('Connected to relay', { url: this.relayUrl });
    });

    this.ws.on('message', (data) => {
      try {
        const raw = JSON.parse(data.toString()) as Record<string, unknown>;
        this.handleMessage(raw);
      } catch (err) {
        logger.warn('Invalid relay message', { error: String(err) });
      }
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.authenticated = false;
      logger.info('Disconnected from relay');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      logger.error('Relay connection error', { error: String(err) });
      if (!this.authenticated) {
        this.connectReject?.(err instanceof Error ? err : new Error(String(err)));
        this.connectResolve = null;
        this.connectReject = null;
      }
    });
  }

  // HIGH-11: Validate incoming messages with Zod schemas instead of unsafe casts
  private handleMessage(raw: Record<string, unknown>): void {
    const msgType = raw['type'];

    switch (msgType) {
      case 'challenge': {
        const parsed = AuthChallengeSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn('Invalid challenge message', { error: parsed.error.message });
          return;
        }
        // HIGH-4: Validate nonce has minimum entropy (at least 16 bytes base64)
        if (parsed.data.nonce.length < 16) {
          logger.warn('Challenge nonce too short — possible rogue relay');
          return;
        }
        const signature = signChallenge(this.identity.secretKey, parsed.data.nonce);
        this.send({
          type: 'auth',
          peer_id: this.identity.peerId,
          signature,
          public_key: publicKeyToBase64(this.identity.publicKey),
        });
        break;
      }
      case 'ack': {
        // MED-6: Only resolve connect promise on initial auth ack
        if (!this.authenticated) {
          this.authenticated = true;
          logger.info('Authenticated with relay', { peerId: this.identity.peerId });
          this.connectResolve?.();
          this.connectResolve = null;
          this.connectReject = null;
        }
        // Ignore heartbeat acks silently
        break;
      }
      case 'relay': {
        const parsed = RelayMessageSchema.safeParse(raw);
        if (!parsed.success) {
          logger.warn('Invalid relay message format', { error: parsed.error.message });
          return;
        }
        this.onMessageHandler?.(parsed.data.from, parsed.data.payload);
        break;
      }
      case 'error': {
        const parsed = RelayErrorSchema.safeParse(raw);
        const errorMsg = parsed.success ? parsed.data.message : 'Unknown relay error';
        logger.error('Relay error', { message: errorMsg });
        break;
      }
      case 'queued': {
        // Delivery queued notice — informational only
        logger.debug('Message queued for offline peer', { raw });
        break;
      }
    }
  }

  async sendRelay(toPeerId: string, payload: EncryptedPayload): Promise<void> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with relay server');
    }
    // HIGH-8: Check readyState explicitly and throw instead of silently dropping
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }
    this.ws.send(JSON.stringify({
      type: 'relay',
      from: this.identity.peerId,
      to: toPeerId,
      payload,
    }));
  }

  onMessage(handler: RelayMessageHandler): void {
    this.onMessageHandler = handler;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
  }

  get isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    logger.info(`Reconnecting in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.doConnect();
    }, this.reconnectDelay);
  }
}
