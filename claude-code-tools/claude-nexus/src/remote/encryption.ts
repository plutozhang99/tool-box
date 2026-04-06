import { createHash } from 'node:crypto';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

export interface EncryptedPayload {
  readonly nonce: string;
  readonly ciphertext: string;
}

/**
 * CRIT-3 fix: Domain-separated key derivation.
 * Derive a Curve25519 box keypair from the Ed25519 secret key seed
 * using SHA-256 with a domain separator, ensuring the box key is
 * cryptographically independent from the signing key.
 */
function deriveBoxKeyPair(ed25519SecretKey: Uint8Array): nacl.BoxKeyPair {
  const seed = ed25519SecretKey.slice(0, 32);
  const boxSeed = createHash('sha256')
    .update('claude-nexus-box-v1:')
    .update(seed)
    .digest();
  return nacl.box.keyPair.fromSecretKey(new Uint8Array(boxSeed));
}

export function deriveBoxPublicKey(ed25519SecretKey: Uint8Array): Uint8Array {
  return deriveBoxKeyPair(ed25519SecretKey).publicKey;
}

export function encryptMessage(
  content: string,
  senderSecretKey: Uint8Array,
  recipientBoxPublicKey: Uint8Array,
): EncryptedPayload {
  const messageBytes = new TextEncoder().encode(content);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  const senderBox = deriveBoxKeyPair(senderSecretKey);

  const ciphertext = nacl.box(messageBytes, nonce, recipientBoxPublicKey, senderBox.secretKey);

  if (!ciphertext) {
    throw new Error('Encryption failed');
  }

  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  };
}

export function decryptMessage(
  payload: EncryptedPayload,
  senderBoxPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array,
): string {
  const nonce = decodeBase64(payload.nonce);
  const ciphertext = decodeBase64(payload.ciphertext);

  const recipientBox = deriveBoxKeyPair(recipientSecretKey);

  const decrypted = nacl.box.open(ciphertext, nonce, senderBoxPublicKey, recipientBox.secretKey);

  if (!decrypted) {
    throw new Error('Decryption failed - invalid key or corrupted message');
  }

  return new TextDecoder().decode(decrypted);
}
