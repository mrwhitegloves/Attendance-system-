import mongoose from 'mongoose';

// Managed lists edited in Settings → Lists: departments, designations, branches (employees
// store the name; renaming a list item renames it on every employee), and the tasks of the
// onboarding and exit checklists (copied into each checklist when it starts).

export const EMPLOYEE_LIST_TYPES = ['department', 'designation', 'branch'];
export const CHECKLIST_TYPES = ['onboarding_task', 'exit_task'];
export const LOOKUP_TYPES = [...EMPLOYEE_LIST_TYPES, ...CHECKLIST_TYPES];

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
