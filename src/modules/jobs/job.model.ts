import { Schema, model, models, type HydratedDocument, type Model, type Types } from 'mongoose';

import {
  JOB_STATUSES,
  JOB_TYPES,
  JOB_TYPE_LABELS,
  type JobStatus,
  type JobType,
  type PublicJob,
} from '@/modules/jobs/job.constants';

export { JOB_STATUSES, JOB_TYPES, JOB_TYPE_LABELS };
export type { JobStatus, JobType, PublicJob };

export interface JobAttributes {
  title: string;
  description: string;
  location: string;
  jobType: JobType;
  status: JobStatus;
  /** The HR user who owns this listing; only they may edit or delete it. */
  postedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type JobDocument = HydratedDocument<JobAttributes>;

const jobSchema = new Schema<JobAttributes>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 10_000 },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    jobType: { type: String, required: true, enum: JOB_TYPES },
    status: { type: String, required: true, enum: JOB_STATUSES, default: 'OPEN' },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

// Candidate browsing filters on status + location/type and sorts by recency.
jobSchema.index({ status: 1, createdAt: -1 });
// HR listing pages always scope by owner first.
jobSchema.index({ postedBy: 1, createdAt: -1 });

export const Job: Model<JobAttributes> =
  (models.Job as Model<JobAttributes>) ?? model<JobAttributes>('Job', jobSchema);

export function toPublicJob(job: JobDocument): PublicJob {
  return {
    id: String(job._id),
    title: job.title,
    description: job.description,
    location: job.location,
    jobType: job.jobType,
    status: job.status,
    postedBy: String(job.postedBy),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
