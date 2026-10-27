import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

// The ONLY file that talks to S3. The bucket is private: files are read through short signed links.
// Nothing is ever deleted from S3 (CEO rule): there is deliberately no delete function here.

let client = null;

export const isStorageConfigured = () =>
  Boolean(
    env.S3_BUCKET &&
    env.AWS_REGION &&
    env.AWS_S3_IAM_ACCESS_KEY_ID &&
    env.AWS_S3_IAM_SECRET_ACCESS_KEY,
  );

function s3() {
  if (!client) {
    client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_S3_IAM_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_S3_IAM_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

/** Saves bytes under a key and returns the key. */
export async function putFile(key, bytes, contentType) {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
  return key;
}

/** A link that opens the private file for a short time (default 15 minutes). */
export async function signedUrl(key, seconds = 15 * 60) {
  if (!key || !isStorageConfigured()) return null;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: seconds,
  });
}
