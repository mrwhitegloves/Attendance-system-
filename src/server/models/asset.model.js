import mongoose from 'mongoose';
import { ASSET_CATEGORIES, ASSET_STATUSES } from '../../config/assetOptions.js';

// A company asset (laptop, phone, ID card …). Collection `assets`. Who has it now is on the
// asset; every hand-over and return is kept in `history`, newest last. Money in paise.

const historySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['added', 'assigned', 'returned', 'status'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeId: { type: String, default: '' },
    employeeName: { type: String, default: '' },
    status: { type: String, default: '' },
    condition: { type: String, default: '' },
    note: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const assetSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // "AST-0001"
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: Object.keys(ASSET_CATEGORIES), required: true, index: true },
    serialNumber: { type: String, default: '', trim: true },
    valuePaise: { type: Number, default: null, min: 0 },
    purchasedOn: { type: String, default: '' },
    note: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: Object.keys(ASSET_STATUSES), default: 'in_stock', index: true },
    // While assigned: the employee who has it.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    employeeId: { type: String, default: '', index: true },
    employeeName: { type: String, default: '' },
    assignedAt: { type: Date, default: null },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

export const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);
