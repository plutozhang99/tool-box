import nacl from 'tweetnacl';
import {
  encodeBase64,
  decodeBase64,
  decodeUTF8,
} from 'tweetnacl-util';
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import { deriveBoxPublicKey } from './encryption.js';

export interface Identity {
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
  readonly boxPublicKey: Uint8Array;
  readonly peerId: string;
}

const IDENTITY_DIR = 'identity';
const KEYPAIR_FILE = 'keypair.json';

interface StoredKeypair {
  readonly publicKey: string; // base64
  readonly secretKey: string; // base64
}

export function getOrCreateIdentity(dataDir: string): Identity {
  const identityDir = join(dataDir, IDENTITY_DIR);
  const keypairPath = join(identityDir, KEYPAIR_FILE);

  if (existsSync(keypairPath)) {
    const data = JSON.parse(readFileSync(keypairPath, 'utf-8')) as StoredKeypair;
    const publicKey = decodeBase64(data.publicKey);
    const secretKey = decodeBase64(data.secretKey);

    // CRIT-3: Verify keypair integrity — derive public from secret and compare
    const expectedPublicKey = secretKey.slice(32); // Ed25519 secret = [seed(32) | public(32)]
    if (publicKey.length !== expectedPublicKey.length ||
        !publicKey.every((byte, i) => byte === expectedPublicKey[i])) {
      throw new Error(
        'Identity keypair integrity check failed: public key does not match secret key. ' +
        `File may be corrupted: ${keypairPath}`,
      );
    }

    const boxPublicKey = deriveBoxPublicKey(secretKey);
    const peerId = derivePeerId(publicKey);
    logger.info('Loaded existing identity', { peerId });
    return { publicKey, secretKey, boxPublicKey, peerId };
  }

  mkdirSync(identityDir, { recursive: true });

  const keyPair = nacl.sign.keyPair();
  const stored: StoredKeypair = {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };

  writeFileSync(keypairPath, JSON.stringify(stored, null, 2));
  try {
    chmodSync(keypairPath, 0o600);
    // HIGH-5: Verify chmod was applied
    const st = statSync(keypairPath);
    const mode = st.mode & 0o777;
    if (mode !== 0o600) {
      logger.warn('Failed to restrict keypair file permissions', {
        path: keypairPath,
        expected: '0600',
        actual: `0${mode.toString(8)}`,
      });
    }
  } catch {
    logger.warn(
      'Could not set restrictive permissions on keypair file. ' +
      'The secret key is stored in plaintext — ensure the file is protected.',
      { path: keypairPath },
    );
  }

  const boxPublicKey = deriveBoxPublicKey(keyPair.secretKey);
  const peerId = derivePeerId(keyPair.publicKey);
  logger.info('Created new identity', { peerId });

  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
    boxPublicKey,
    peerId,
  };
}

export function signChallenge(secretKey: Uint8Array, nonce: string): string {
  const nonceBytes = decodeUTF8(nonce);
  const signature = nacl.sign.detached(nonceBytes, secretKey);
  return encodeBase64(signature);
}

export function verifySignature(
  publicKey: Uint8Array,
  nonce: string,
  signature: string,
): boolean {
  const nonceBytes = decodeUTF8(nonce);
  const sigBytes = decodeBase64(signature);
  return nacl.sign.detached.verify(nonceBytes, sigBytes, publicKey);
}

function derivePeerId(publicKey: Uint8Array): string {
  return encodeBase64(publicKey).slice(0, 22);
}

export function publicKeyToBase64(publicKey: Uint8Array): string {
  return encodeBase64(publicKey);
}

export function base64ToPublicKey(b64: string): Uint8Array {
  return decodeBase64(b64);
}
