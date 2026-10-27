import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { createAppError } from './errors.js';

// Seals sensitive numbers (PAN, bank account) before they are stored: AES-256-GCM with the key
// in DATA_ENCRYPTION_KEY (32 bytes, base64). Only the KYC service seals and opens values.

function key() {
  const raw = env.DATA_ENCRYPTION_KEY ? Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64') : null;
  if (!raw || raw.length !== 32) {
    throw createAppError(
      503,
      'Secure storage for KYC numbers is not set up yet (DATA_ENCRYPTION_KEY).',
    );
  }
  return raw;
}

/** "ABCDE1234F" → "v1.<iv>.<tag>.<data>" */
export function seal(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function open(sealed) {
  if (!sealed) return null;
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1') throw createAppError(500, 'Unknown sealed value.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
