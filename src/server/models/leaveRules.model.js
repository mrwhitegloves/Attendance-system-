import mongoose from 'mongoose';

// What decides a paid day besides approved leave (founder, 2026-10-27):
// - holidays: occasions, festivals and national holidays saved in advance (Settings → Holidays);
// - comp-offs: an employee worked on a Sunday and takes another day off in exchange (HR records it);
// - the paid leave balance: days HR gives an employee, and days taken from it, per month.

export const HOLIDAY_KINDS = {
  occasion: 'Occasion',
  festival: 'Festival',
  national: 'National holiday',
};

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // "2026-11-08"
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: Object.keys(HOLIDAY_KINDS), default: 'festival' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'holidays' },
);
export const Holiday = mongoose.models.Holiday || mongoose.model('Holiday', holidaySchema);

const compOffSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    workedOn: { type: String, required: true }, // the Sunday worked
    offOn: { type: String, required: true }, // the day off taken in exchange (paid)
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'comp_offs' },
);
compOffSchema.index({ userId: 1, workedOn: 1 }, { unique: true });
compOffSchema.index({ userId: 1, offOn: 1 }, { unique: true });
export const CompOff = mongoose.models.CompOff || mongoose.model('CompOff', compOffSchema);

// The paid leave balance is a ledger: +days given by HR, −days taken with an approved paid leave.
// `month` is the month the entry belongs to; the balance at a month adds every entry up to it.
const leaveBalanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    days: { type: Number, required: true }, // +2 given, −1 taken; half days allowed
    month: { type: String, required: true }, // "2026-11"
    reason: { type: String, default: '' },
    leaveRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'leave_balance_entries' },
);
leaveBalanceSchema.index(
  { leaveRequestId: 1 },
  { unique: true, partialFilterExpression: { leaveRequestId: { $type: 'objectId' } } },
);
export const LeaveBalanceEntry =
  mongoose.models.LeaveBalanceEntry || mongoose.model('LeaveBalanceEntry', leaveBalanceSchema);
