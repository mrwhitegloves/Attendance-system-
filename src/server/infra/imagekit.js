import { env } from '../config/env.js';

// Old selfies of the first version live in ImageKit. New photos go to S3; this file only
// deletes old ImageKit photos after 30 days.

export const isImageKitConfigured = () => Boolean(env.IMAGEKIT_PRIVATE_KEY);

/** Deletes one ImageKit file. True when it is gone (also when it was already gone). */
export async function deleteImageKitFile(fileId) {
  if (!isImageKitConfigured()) return false;
  const auth = Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64');
  const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${auth}` },
  });
  return response.ok || response.status === 404;
}
