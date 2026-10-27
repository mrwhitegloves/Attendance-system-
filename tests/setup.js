import { afterAll, afterEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Every test file gets its own in-memory MongoDB. Tests never touch a real database or S3.
// A fixed test key for sealing KYC numbers (never used outside tests).
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
delete process.env.S3_DEV_BUCKET;
delete process.env.S3_PROD_BUCKET;
let server;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
