// Every setting the server reads from the environment, in one place.
// Other code imports `env` from here and never reads process.env itself.

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

const read = (name) => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : '';
};

export const env = {
  isProduction,
  isTest,
  // Production database unless we run in development (then the dev database).
  DATABASE_URI: isProduction ? read('MONGO_URI') : read('MONGO_URI_DEV'),

  // Session cookie lifetime in days (phones stay signed in).
  SESSION_DAYS: Number(read('SESSION_DAYS')) || 30,

  // First CEO account, created once if no CEO exists (replaces the old admin login from env).
  ADMIN_EMAIL: read('ADMIN_EMAIL'),
  ADMIN_USERNAME: read('ADMIN_USERNAME'),
  ADMIN_PASSWORD: read('ADMIN_PASSWORD'),

  // Private S3 bucket for selfies and documents. Optional: without it, photos are not stored.
  AWS_REGION: read('AWS_REGION'),
  AWS_S3_IAM_ACCESS_KEY_ID: read('AWS_S3_IAM_ACCESS_KEY_ID'),
  AWS_S3_IAM_SECRET_ACCESS_KEY: read('AWS_S3_IAM_SECRET_ACCESS_KEY'),
  S3_BUCKET: isProduction ? read('S3_PROD_BUCKET') : read('S3_DEV_BUCKET'),

  // 32-byte key (base64) that seals PAN and bank account numbers. Required for KYC numbers.
  DATA_ENCRYPTION_KEY: read('DATA_ENCRYPTION_KEY'),

  // Web push.
  VAPID_PUBLIC_KEY: read('NEXT_PUBLIC_VAPID_PUBLIC_KEY'),
  VAPID_PRIVATE_KEY: read('VAPID_PRIVATE_KEY'),
  VAPID_SUBJECT: read('VAPID_SUBJECT') || 'mailto:admin@mrwhitegloves.com',
};
