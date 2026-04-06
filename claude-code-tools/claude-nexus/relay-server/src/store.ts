import { randomUUID } from 'node:crypto';
import type { RelayMessage } from './types.js';

interface QueuedMessage {
  readonly message: RelayMessage;
  readonly queuedAt: number;
  readonly senderId: string;
}

export class MessageStore {
  private readonly queues: Map<string, QueuedMessage[]> = new Map();
  private readonly ttlMs: number;
  private readonly maxPerPeer: number;
  private readonly maxTotalRecipients: number;

  // HIGH-2: Track sender -> how many distinct recipients they've queued to
  private readonly senderRecipientCount: Map<string, Set<string>> = new Map();
  private readonly maxRecipientsPerSender: number;

  constructor(
    ttlMs: number = 86400000,
    maxPerPeer: number = 100,
    maxTotalRecipients: number = 10000,
    maxRecipientsPerSender: number = 50,
  ) {
    this.ttlMs = ttlMs;
    this.maxPerPeer = maxPerPeer;
    this.maxTotalRecipients = maxTotalRecipients;
    this.maxRecipientsPerSender = maxRecipientsPerSender;
  }

  enqueue(toPeerId: string, message: RelayMessage, senderId: string): string {
    // LOW-1: Use crypto.randomUUID instead of Math.random
    const messageId = randomUUID();

    // HIGH-2: Check sender's recipient spread
    const senderTargets = this.senderRecipientCount.get(senderId) ?? new Set<string>();
    senderTargets.add(toPeerId);
    if (senderTargets.size > this.maxRecipientsPerSender) {
      throw new Error('Too many distinct recipients queued');
    }
    this.senderRecipientCount.set(senderId, senderTargets);

    // Check total queue count
    if (this.queues.size >= this.maxTotalRecipients && !this.queues.has(toPeerId)) {
      throw new Error('Queue capacity reached');
    }

    const queue = this.queues.get(toPeerId) ?? [];

    queue.push({
      message: { ...message, message_id: messageId },
      queuedAt: Date.now(),
      senderId,
    });

    // Trim if over limit
    if (queue.length > this.maxPerPeer) {
      queue.splice(0, queue.length - this.maxPerPeer);
    }

    this.queues.set(toPeerId, queue);
    return messageId;
  }

  dequeue(peerId: string): readonly RelayMessage[] {
    const queue = this.queues.get(peerId);
    if (!queue || queue.length === 0) return [];

    // Clean up sender tracking for dequeued messages
    for (const item of queue) {
      const senderTargets = this.senderRecipientCount.get(item.senderId);
      if (senderTargets) {
        senderTargets.delete(peerId);
        if (senderTargets.size === 0) {
          this.senderRecipientCount.delete(item.senderId);
        }
      }
    }

    this.queues.delete(peerId);
    const now = Date.now();
    return queue
      .filter((q) => now - q.queuedAt < this.ttlMs)
      .map((q) => q.message);
  }

  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [peerId, queue] of this.queues) {
      const remaining = queue.filter((q) => now - q.queuedAt < this.ttlMs);
      pruned += queue.length - remaining.length;
      if (remaining.length === 0) {
        this.queues.delete(peerId);
      } else {
        this.queues.set(peerId, remaining);
      }
    }
    // Also prune sender tracking for removed queues
    if (pruned > 0) {
      this.rebuildSenderTracking();
    }
    return pruned;
  }

  private rebuildSenderTracking(): void {
    this.senderRecipientCount.clear();
    for (const [peerId, queue] of this.queues) {
      for (const item of queue) {
        const targets = this.senderRecipientCount.get(item.senderId) ?? new Set<string>();
        targets.add(peerId);
        this.senderRecipientCount.set(item.senderId, targets);
      }
    }
  }

  get stats(): { peers: number; totalMessages: number } {
    let totalMessages = 0;
    for (const queue of this.queues.values()) {
      totalMessages += queue.length;
    }
    return { peers: this.queues.size, totalMessages };
  }
}
