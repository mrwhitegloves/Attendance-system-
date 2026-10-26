// npm run migrate — runs pending migrations against the database of this environment
// (development database unless NODE_ENV=production). They also run at server start.
import mongoose from 'mongoose';
import { connectDb } from '../src/server/db.js';
import { runMigrations, ensureCeoAccount, MIGRATIONS } from '../src/server/migrations/index.js';
import { Migration } from '../src/server/models/system.models.js';

await connectDb();
if (process.argv[2] === 'status') {
  const done = new Set((await Migration.find({}, 'name').lean()).map((row) => row.name));
  for (const migration of MIGRATIONS)
    console.log(done.has(migration.name) ? 'done   ' : 'pending', migration.name);
} else {
  const ran = await runMigrations();
  console.log(ran.length ? `Ran: ${ran.join(', ')}` : 'Nothing to run.');
  const ceo = await ensureCeoAccount();
  if (ceo) console.log(`CEO account ${ceo}.`);
}
await mongoose.disconnect();
