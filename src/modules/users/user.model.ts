import { Schema, model, models, type HydratedDocument, type Model, type Types } from 'mongoose';

import {
  EXPERIENCE_LEVELS,
  USER_ROLES,
  type ExperienceLevel,
  type PublicUser,
  type SearchableCandidate,
  type UserRole,
} from '@/modules/users/user.constants';

export { EXPERIENCE_LEVELS, USER_ROLES };
export type { ExperienceLevel, PublicUser, SearchableCandidate, UserRole };

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
  };
}

/**
 * Projection used for candidate search results.
 *
 * Separate from toPublicUser on purpose: this is the shape one user sees of
 * another, so email and phone are structurally absent rather than filtered out
 * by a caller who might forget.
 */
export function toSearchableCandidate(user: UserLike): SearchableCandidate {
  return {
    id: String(user._id),
    name: user.name,
    headline: user.headline ?? null,
    skills: user.skills ?? [],
    experienceLevel: user.experienceLevel ?? null,
  };
}
