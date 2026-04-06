import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import { encryptMessage, decryptMessage, deriveBoxPublicKey } from '../../src/remote/encryption.js';

describe('encryption', () => {
  it('encrypts and decrypts a message roundtrip', () => {
    const sender = nacl.sign.keyPair();
    const recipient = nacl.sign.keyPair();

    // Derive box public keys from secret keys
    const senderBoxPub = deriveBoxPublicKey(sender.secretKey);
    const recipientBoxPub = deriveBoxPublicKey(recipient.secretKey);

    const plaintext = 'Hello from remote peer!';
    const payload = encryptMessage(plaintext, sender.secretKey, recipientBoxPub);

    expect(payload.nonce).toBeDefined();
    expect(payload.ciphertext).toBeDefined();
    expect(payload.ciphertext).not.toBe(plaintext);

    const decrypted = decryptMessage(payload, senderBoxPub, recipient.secretKey);
    expect(decrypted).toBe(plaintext);
  });

  it('fails to decrypt with wrong key', () => {
    const sender = nacl.sign.keyPair();
    const recipient = nacl.sign.keyPair();
    const wrongRecipient = nacl.sign.keyPair();

    const recipientBoxPub = deriveBoxPublicKey(recipient.secretKey);
    const senderBoxPub = deriveBoxPublicKey(sender.secretKey);

    const payload = encryptMessage('secret', sender.secretKey, recipientBoxPub);

    expect(() =>
      decryptMessage(payload, senderBoxPub, wrongRecipient.secretKey),
    ).toThrow();
  });

  it('handles unicode content', () => {
    const sender = nacl.sign.keyPair();
    const recipient = nacl.sign.keyPair();

    const senderBoxPub = deriveBoxPublicKey(sender.secretKey);
    const recipientBoxPub = deriveBoxPublicKey(recipient.secretKey);

    const plaintext = '你好世界 🌍 こんにちは';
    const payload = encryptMessage(plaintext, sender.secretKey, recipientBoxPub);
    const decrypted = decryptMessage(payload, senderBoxPub, recipient.secretKey);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for same message (random nonce)', () => {
    const sender = nacl.sign.keyPair();
    const recipient = nacl.sign.keyPair();
    const recipientBoxPub = deriveBoxPublicKey(recipient.secretKey);

    const payload1 = encryptMessage('test', sender.secretKey, recipientBoxPub);
    const payload2 = encryptMessage('test', sender.secretKey, recipientBoxPub);

    expect(payload1.ciphertext).not.toBe(payload2.ciphertext);
    expect(payload1.nonce).not.toBe(payload2.nonce);
  });
});
