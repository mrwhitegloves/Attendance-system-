import mongoose from 'mongoose';

// Small technical collections: counters, sessions, push subscriptions, audit log, migrations.

const counterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});
export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// A signed-in browser. Only a SHA-256 hash of the cookie value is stored.
const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Old field of the first version (every old subscription belongs to an admin device).
    adminId: { type: String, default: null },
  },
  { timestamps: true },
);
export const PushSubscription =
  mongoose.models.PushSubscription || mongoose.model('PushSubscription', pushSubscriptionSchema);

// Who changed what. Written only by recordAudit().
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorName: { type: String, default: 'System' },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: null, index: true },
    summary: { type: String, default: '' },
    changes: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

const migrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    ranAt: { type: Date, default: Date.now },
  },
  { collection: 'migrations' },
);
export const Migration = mongoose.models.Migration || mongoose.model('Migration', migrationSchema);
