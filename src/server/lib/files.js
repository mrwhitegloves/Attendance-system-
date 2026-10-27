import { createAppError } from './errors.js';

// Uploaded files arrive as data URLs ("data:application/pdf;base64,…"). Only these kinds are
// accepted, at most 5 MB.

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const KINDS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const ACCEPTED_FILE_TYPES = Object.keys(KINDS).join(',');

/** → { bytes, contentType, extension } or a 400/413 error. */
export function decodeFileDataUrl(dataUrl) {
  const [, contentType, data] = String(dataUrl).match(/^data:([a-z/+.-]+);base64,(.+)$/) || [];
  if (!KINDS[contentType])
    throw createAppError(400, 'Please choose a PDF or a photo (JPG, PNG, WebP).');
  const bytes = Buffer.from(data || '', 'base64');
  if (!bytes.length) throw createAppError(400, 'The file is empty.');
  if (bytes.length > MAX_FILE_BYTES) throw createAppError(413, 'The file is larger than 5 MB.');
  return { bytes, contentType, extension: KINDS[contentType] };
}

/** A file name safe for storage keys: letters, numbers, dots, dashes. */
export const safeFileName = (name) =>
  String(name || 'file')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'file';
