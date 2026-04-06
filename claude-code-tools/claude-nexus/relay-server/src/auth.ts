import nacl from 'tweetnacl';
import tweetnaclUtil from 'tweetnacl-util';
const { decodeBase64, decodeUTF8, encodeBase64 } = tweetnaclUtil;
import { randomBytes } from 'node:crypto';

export function generateNonce(): string {
  return randomBytes(32).toString('base64');
}

export function verifyAuth(
  publicKeyBase64: string,
  nonce: string,
  signatureBase64: string,
): boolean {
  try {
    const publicKey = decodeBase64(publicKeyBase64);
    const nonceBytes = decodeUTF8(nonce);
    const signature = decodeBase64(signatureBase64);
    return nacl.sign.detached.verify(nonceBytes, signature, publicKey);
  } catch {
    return false;
  }
}

// CRIT-2: Server-side peerId derivation — must match client's derivePeerId
export function derivePeerIdFromPublicKey(publicKeyBase64: string): string {
  // Must match the client-side derivation in identity.ts
  return publicKeyBase64.slice(0, 22);
}
