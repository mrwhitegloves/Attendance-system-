import { createAppError } from './errors.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** "data:image/jpeg;base64,…" → { bytes, contentType, extension }. Refuses empty or > 2 MB. */
export function decodeImageDataUrl(dataUrl) {
  const [, type, data] = String(dataUrl).match(/^data:image\/(jpeg|png|webp);base64,(.+)$/) || [];
  const bytes = Buffer.from(data || '', 'base64');
  if (!bytes.length) throw createAppError(400, 'Please choose or take a photo first.');
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw createAppError(413, 'The photo is too large (more than 2 MB). Please try again.');
  }
  return { bytes, contentType: `image/${type}`, extension: type === 'jpeg' ? 'jpg' : type };
}
