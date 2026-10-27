import mongoose from 'mongoose';

// Managed lists edited in Settings → Lists: departments, designations, branches.
// Employees store the name; renaming a list item renames it on every employee.

export const LOOKUP_TYPES = ['department', 'designation', 'branch'];

const lookupSchema = new mongoose.Schema(
  {
    type: { type: String, enum: LOOKUP_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

lookupSchema.index(
  { type: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

export const Lookup = mongoose.models.Lookup || mongoose.model('Lookup', lookupSchema);
