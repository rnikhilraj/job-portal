import { Schema, model, models, type HydratedDocument, type Model, type Types } from 'mongoose';

import { USER_ROLES, type PublicUser, type UserRole } from '@/modules/users/user.constants';

export { USER_ROLES };
export type { PublicUser, UserRole };

export interface UserAttributes {
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  phone?: string;
  headline?: string;
  skills: string[];
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
  },
  { timestamps: true },
);

export const User: Model<UserAttributes> =
  (models.User as Model<UserAttributes>) ?? model<UserAttributes>('User', userSchema);

export function toPublicUser(user: UserDocument | (UserAttributes & { _id: Types.ObjectId })): PublicUser {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    name: user.name,
    phone: user.phone ?? null,
    headline: user.headline ?? null,
    skills: user.skills ?? [],
  };
}
