import mongoose from 'mongoose';

// Recently deleted (founder, 2026-10-29). Collection `deleted_items`. Nothing is deleted
// directly: the records are copied here exactly as they were (`parts`: one entry per collection)
// and then removed from their place. Restore puts the same records back. After 90 days MongoDB
// removes the item by itself (TTL index on `expiresAt`). Files in S3 are never deleted.

export const TRASH_DAYS = 90;

const deletedItemSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, index: true }, // employee, offer_letter, kyc_link …
    label: { type: String, required: true }, // "Vivek Pradhan (MWG-006)"
    detail: { type: String, default: '' }, // "Employee · 214 attendance records"
    entityId: { type: String, default: '' },
    // [{ collection: 'users', docs: [ … ] }] — the records exactly as stored.
    parts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedByName: { type: String, default: '' },
    deletedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'deleted_items' },
);
deletedItemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DeletedItem =
  mongoose.models.DeletedItem || mongoose.model('DeletedItem', deletedItemSchema);
