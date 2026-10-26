// Runs once when the server starts: pending migrations, then the first CEO account.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Never touch a database while building.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { connectDb } = await import('./server/db.js');
  const { runMigrations, ensureCeoAccount } = await import('./server/migrations/index.js');
  try {
    await connectDb();
    const ran = await runMigrations();
    if (ran.length) console.log('[startup] migrations ran:', ran.join(', '));
    const ceo = await ensureCeoAccount();
    if (ceo) console.log(`[startup] CEO account ${ceo}`);
  } catch (error) {
    console.error('[startup] migrations failed', error);
  }
}
