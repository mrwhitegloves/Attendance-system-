import mongoose from 'mongoose';

// The joining checklist of one employee (CEO spec: "complete joining checklist: KYC, bank,
// agreements and joining confirmation"). Collection `onboardings`, one per employee. The tasks
// are copied from Settings → Lists when it starts, so a later change to the list never changes
// a checklist already running. The automatic checks (file complete, letter accepted) are worked
// out when it is read, never stored.

export const taskSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
    doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    doneByName: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: true },
);

const onboardingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
      index: true,
    },
    tasks: { type: [taskSchema], default: [] },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedByName: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Onboarding =
  mongoose.models.Onboarding || mongoose.model('Onboarding', onboardingSchema);
