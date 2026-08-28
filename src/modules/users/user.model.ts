import { Schema, model, models, type HydratedDocument, type Model, type Types } from 'mongoose';

import { resumeFileSchema, type ResumeFile } from '@/lib/resume-storage';
import {
  EXPERIENCE_LEVELS,
  USER_ROLES,
  type DiscoverableCandidate,
  type ExperienceLevel,
  type PublicUser,
  type ResumeSummary,
  type UserRole,
} from '@/modules/users/user.constants';

export { EXPERIENCE_LEVELS, USER_ROLES };
export type { DiscoverableCandidate, ExperienceLevel, PublicUser, ResumeSummary, UserRole };

export interface UserAttributes {
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  phone?: string;
  headline?: string;
  skills: string[];
  /**
   * Candidate-only opt-in to HR's candidate search. Defaults to false, so an
   * account is never discoverable until its owner deliberately turns this on.
   */
  isSearchable: boolean;
  /** Candidate-only. Optional: a candidate may opt in without declaring one. */
  experienceLevel?: ExperienceLevel;
  /**
   * Candidate-only general resume, uploaded from the profile page and
   * independent of any application. Visible to recruiters only while
   * isSearchable is true.
   */
  resume?: ResumeFile;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // Never returned by default — a query must opt in with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: USER_ROLES },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    headline: { type: String, trim: true, maxlength: 160 },
    skills: { type: [String], default: [] },
    // `default: false` matters as much as the query filter: accounts created
    // before this field existed read back as false rather than undefined.
    isSearchable: { type: Boolean, required: true, default: false },
    experienceLevel: { type: String, enum: EXPERIENCE_LEVELS },
    resume: { type: resumeFileSchema, required: false },
  },
  { timestamps: true },
);

// Candidate search always filters on role + isSearchable before anything else.
userSchema.index({ role: 1, isSearchable: 1, createdAt: -1 });

export const User: Model<UserAttributes> =
  (models.User as Model<UserAttributes>) ?? model<UserAttributes>('User', userSchema);

type UserLike = UserDocument | (UserAttributes & { _id: Types.ObjectId });

export function toPublicUser(user: UserLike): PublicUser {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    name: user.name,
    phone: user.phone ?? null,
    headline: user.headline ?? null,
    skills: user.skills ?? [],
    isSearchable: user.isSearchable ?? false,
    experienceLevel: user.experienceLevel ?? null,
    resume: toResumeSummary(user.resume),
  };
}

function toResumeSummary(resume: ResumeFile | undefined): ResumeSummary | null {
  if (!resume) return null;
  // Note the absence of storedName: the path on disk never leaves the server.
  return { originalName: resume.originalName, sizeBytes: resume.sizeBytes };
}

/**
 * The only constructor for DiscoverableCandidate — the shape one user sees of
 * another through the opt-in directory.
 *
 * It fails closed. If it is ever handed a user who is not an opted-in candidate
 * it throws instead of returning a redacted object, so a future caller that
 * forgets the isSearchable filter produces a 500 and a server-side log rather
 * than quietly leaking somebody's email address. The queries that feed it
 * already pin `role` and `isSearchable`; this is the second lock, not the first.
 */
export function toDiscoverableCandidate(user: UserLike): DiscoverableCandidate {
  if (user.role !== 'CANDIDATE' || user.isSearchable !== true) {
    throw new Error(
      `refusing to build a discoverable profile for user ${String(user._id)}: ` +
        'not an opted-in candidate',
    );
  }

  return {
    id: String(user._id),
    name: user.name,
    headline: user.headline ?? null,
    skills: user.skills ?? [],
    experienceLevel: user.experienceLevel ?? null,
    email: user.email,
    phone: user.phone ?? null,
    resume: toResumeSummary(user.resume),
  };
}
