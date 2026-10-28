import mongoose from 'mongoose';

// Roles and their permissions, edited by the CEO in Settings → Roles and permissions.
// `permissions` maps a permission key to a scope ('own' | 'team' | 'all') or true.
const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true, trim: true },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    // The CEO role: always every permission, cannot be changed.
    locked: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'roles', minimize: false },
);

export const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
