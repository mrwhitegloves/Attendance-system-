import mongoose from 'mongoose';
import { env } from './config/env.js';

// One Mongoose connection for the whole server, reused across requests and hot reloads.
const cached = globalThis.__mongoose ?? (globalThis.__mongoose = { promise: null });

/** Connects once and returns the Mongoose instance. Tests connect themselves first. */
export async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cached.promise) {
    if (!env.DATABASE_URI) {
      throw new Error(
        env.isProduction
          ? 'MONGO_URI is not set'
          : 'MONGO_URI_DEV is not set (development database)',
      );
    }
    cached.promise = mongoose
      .connect(env.DATABASE_URI, { bufferCommands: false })
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }
  await cached.promise;
  return mongoose;
}
