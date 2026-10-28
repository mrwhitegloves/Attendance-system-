// npm run backup -- <folder> — copies every collection of this environment's database into
// <folder>/<database>-<date-time>/, one Extended JSON file per collection (keeps ObjectId and
// Date types). Read-only: it never writes to the database. Production: NODE_ENV=production.
// The folder holds passwords and sealed KYC numbers: keep it off GitHub and off shared drives.
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDb } from '../src/server/db.js';

const target = process.argv[2];
if (!target) {
  console.error('Give a folder: npm run backup -- D:\\backups\\hrms');
  process.exit(1);
}

await connectDb();
const db = mongoose.connection.db;
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const folder = path.resolve(target, `${db.databaseName}-${stamp}`);
fs.mkdirSync(folder, { recursive: true });

const { EJSON } = mongoose.mongo.BSON;
const collections = (await db.listCollections({ type: 'collection' }).toArray()).map((c) => c.name);
for (const name of collections.sort()) {
  const out = fs.createWriteStream(path.join(folder, `${name}.json`));
  out.write('[\n');
  let count = 0;
  for await (const doc of db.collection(name).find()) {
    out.write(`${count ? ',\n' : ''}${EJSON.stringify(doc, { relaxed: false })}`);
    count += 1;
  }
  out.write('\n]\n');
  await new Promise((resolve) => out.end(resolve));
  console.log(`${String(count).padStart(7)}  ${name}`);
}
console.log(`Saved ${collections.length} collections in ${folder}`);
await mongoose.disconnect();
