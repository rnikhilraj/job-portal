import { Schema, model, models, type HydratedDocument, type Model, type Types } from 'mongoose';

export const APPLICATION_STATUSES = ['APPLIED', 'REVIEWED', 'SHORTLISTED', 'REJECTED'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Metadata about the stored resume. The file itself lives on the uploads volume. */
export interface ResumeFile {
  /** Random server-generated filename on disk — never anything the client sent. */
  storedName: string;
  /** Sanitised original filename, kept only to label the download. */
  originalName: string;
  sizeBytes: number;
  contentType: string;
}

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

const resumeSchema = new Schema<ResumeFile>(
  {
    storedName: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    sizeBytes: { type: Number, required: true },
    contentType: { type: String, required: true },
  },
  { _id: false },
);

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
    resume: { type: resumeSchema, required: true },
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
