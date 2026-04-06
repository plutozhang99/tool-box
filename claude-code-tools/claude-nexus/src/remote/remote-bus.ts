import type { RelayClient } from './relay-client.js';
import type { Identity } from './identity.js';
import { encryptMessage, decryptMessage, type EncryptedPayload } from './encryption.js';
import { base64ToPublicKey } from './identity.js';
import { logger } from '../utils/logger.js';

export interface RemoteMessage {
  readonly fromPeerId: string;
  readonly content: string;
  readonly receivedAt: string;
}

export interface KnownPeer {
  readonly peerId: string;
  readonly publicKey: string; // base64
}

export class RemoteBus {
  private readonly client: RelayClient;
  private readonly identity: Identity;
  private readonly knownPeers: Map<string, Uint8Array> = new Map();
  private readonly inbox: RemoteMessage[] = [];
  private readonly maxInboxSize: number = 1000;

  constructor(client: RelayClient, identity: Identity) {
    this.client = client;
    this.identity = identity;

    this.client.onMessage((fromPeerId, payload) => {
      this.handleIncoming(fromPeerId, payload);
    });
  }

  addKnownPeer(peerId: string, publicKeyBase64: string): void {
    this.knownPeers.set(peerId, base64ToPublicKey(publicKeyBase64));
  }

  async sendRemoteMessage(
    toPeerId: string,
    toPeerPublicKey: string,
    content: string,
  ): Promise<void> {
    const recipientKey = base64ToPublicKey(toPeerPublicKey);
    this.knownPeers.set(toPeerId, recipientKey);

    const payload = encryptMessage(content, this.identity.secretKey, recipientKey);
    await this.client.sendRelay(toPeerId, payload);
    logger.debug('Sent remote message', { toPeerId });
  }

  readRemoteMessages(limit: number = 20): readonly RemoteMessage[] {
    return this.inbox.splice(0, limit);
  }

  private handleIncoming(fromPeerId: string, payload: EncryptedPayload): void {
    const senderPublicKey = this.knownPeers.get(fromPeerId);
    if (!senderPublicKey) {
      logger.warn('Message from unknown peer, cannot decrypt', { fromPeerId });
      this.inbox.push({
        fromPeerId,
        content: `[encrypted message from unknown peer ${fromPeerId} - add their public key first]`,
        receivedAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const content = decryptMessage(payload, senderPublicKey, this.identity.secretKey);
      this.inbox.push({
        fromPeerId,
        content,
        receivedAt: new Date().toISOString(),
      });

      // Trim inbox if too large
      if (this.inbox.length > this.maxInboxSize) {
        this.inbox.splice(0, this.inbox.length - this.maxInboxSize);
      }

      logger.debug('Received remote message', { fromPeerId });
    } catch (err) {
      logger.error('Failed to decrypt remote message', {
        fromPeerId,
        error: String(err),
      });
    }
  }
}
