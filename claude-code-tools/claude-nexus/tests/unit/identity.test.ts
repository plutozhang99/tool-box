import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getOrCreateIdentity,
  signChallenge,
  verifySignature,
  publicKeyToBase64,
  base64ToPublicKey,
} from '../../src/remote/identity.js';

describe('identity', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nexus-id-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a new identity', () => {
    const identity = getOrCreateIdentity(tempDir);
    expect(identity.publicKey).toBeDefined();
    expect(identity.secretKey).toBeDefined();
    expect(identity.peerId).toBeDefined();
    expect(identity.peerId.length).toBeGreaterThan(0);
  });

  it('loads existing identity on second call', () => {
    const id1 = getOrCreateIdentity(tempDir);
    const id2 = getOrCreateIdentity(tempDir);
    expect(id1.peerId).toBe(id2.peerId);
    expect(publicKeyToBase64(id1.publicKey)).toBe(publicKeyToBase64(id2.publicKey));
  });

  it('signs and verifies a challenge', () => {
    const identity = getOrCreateIdentity(tempDir);
    const nonce = 'test-challenge-nonce-12345';
    const signature = signChallenge(identity.secretKey, nonce);
    const valid = verifySignature(identity.publicKey, nonce, signature);
    expect(valid).toBe(true);
  });

  it('rejects invalid signature', () => {
    const id1 = getOrCreateIdentity(tempDir);
    const tempDir2 = mkdtempSync(join(tmpdir(), 'nexus-id-test2-'));
    const id2 = getOrCreateIdentity(tempDir2);

    const nonce = 'some-nonce';
    const signature = signChallenge(id1.secretKey, nonce);
    // Verify with wrong public key
    const valid = verifySignature(id2.publicKey, nonce, signature);
    expect(valid).toBe(false);

    rmSync(tempDir2, { recursive: true, force: true });
  });

  it('roundtrips public key encoding', () => {
    const identity = getOrCreateIdentity(tempDir);
    const b64 = publicKeyToBase64(identity.publicKey);
    const decoded = base64ToPublicKey(b64);
    expect(Buffer.from(decoded)).toEqual(Buffer.from(identity.publicKey));
  });
});
