/**
 * encryption.js
 * AES-256-GCM symmetric encryption for OAuth tokens and API keys.
 * Key material comes from ENCRYPTION_KEY env var (32-byte hex string).
 *
 * Format of encrypted string: base64(iv[12] + authTag[16] + ciphertext)
 */
import { createCipheriv, createDecipheriv, timingSafeEqual, createHmac, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;   // 96-bit IV recommended for GCM
const TAG_LEN = 16;  // 128-bit auth tag

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt plaintext string → base64 envelope.
 * @param {string} plaintext
 * @returns {string} base64-encoded encrypted blob
 */
export function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypt base64 envelope → plaintext string.
 * @param {string} blob  base64-encoded encrypted blob
 * @returns {string} decrypted plaintext
 */
export function decrypt(blob) {
  const key = getKey();
  const buf = Buffer.from(blob, 'base64');
  const iv  = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/**
 * Verify a PandaDoc webhook HMAC-SHA256 signature in constant time.
 * @param {string} payload   raw request body string
 * @param {string} signature hex signature from X-Pandadoc-Signature header
 * @param {string} secret    webhook secret stored per org
 * @returns {boolean}
 */
export function verifyWebhookSignature(payload, signature, secret) {
  try {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
