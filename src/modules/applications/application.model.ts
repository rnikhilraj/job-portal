import { Schema, model, models, type HydratedDocument, type Model, type Types } from 'mongoose';

import { resumeFileSchema, type ResumeFile } from '@/lib/resume-storage';
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from '@/modules/applications/application.constants';

export { APPLICATION_STATUSES };
export type { ApplicationStatus, ResumeFile };

export interface ApplicationAttributes {
  job: Types.ObjectId;
  candidate: Types.ObjectId;
  status: ApplicationStatus;
  coverNote?: string;
  resume: ResumeFile;
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationDocument = HydratedDocument<ApplicationAttributes>;

const applicationSchema = new Schema<ApplicationAttributes>(
  {
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: APPLICATION_STATUSES,
      default: 'APPLIED',
    },
    coverNote: { type: String, trim: true, maxlength: 2000 },
    resume: { type: resumeFileSchema, required: true },
  },
  { timestamps: true },
);

/**
 * Enforces "one application per candidate per job" in the database itself, so
 * two concurrent submissions cannot both slip past an application-level check.
 */
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });

export const Application: Model<ApplicationAttributes> =
  (models.Application as Model<ApplicationAttributes>) ??
  model<ApplicationAttributes>('Application', applicationSchema);
