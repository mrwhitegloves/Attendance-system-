import mongoose from 'mongoose';
import { PLAN_OUTCOMES, REVIEW_KINDS, REVIEW_STATUSES } from '../../config/performanceOptions.js';

// A performance review or an improvement plan of one employee for a period. Collection
// `reviews`. Written by the manager (or HR) as a draft, shared with the employee, who reads it
// and may add a comment. Goals are the targets and KPIs of the period, with what was achieved.

const goalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    target: { type: String, default: '', maxlength: 200 },
    achieved: { type: String, default: '', maxlength: 200 },
    rating: { type: Number, min: 1, max: 5, default: null },
  },
  { _id: false },
);

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    kind: { type: String, enum: Object.keys(REVIEW_KINDS), default: 'review' },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    goals: { type: [goalSchema], default: [] },
    rating: { type: Number, min: 1, max: 5, default: null },
    strengths: { type: String, default: '', maxlength: 2000 },
    improvements: { type: String, default: '', maxlength: 2000 },
    training: { type: String, default: '', maxlength: 1000 },
    outcome: { type: String, enum: [...Object.keys(PLAN_OUTCOMES), ''], default: '' },
    outcomeNote: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: REVIEW_STATUSES, default: 'draft', index: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerName: { type: String, required: true },
    sharedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
    employeeComment: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true },
);

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
