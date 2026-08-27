/**
 * Dependency-free user constants and wire types.
 *
 * Kept separate from user.model.ts so client components can import them without
 * dragging Mongoose into the browser bundle.
 */
export const USER_ROLES = ['HR', 'CANDIDATE'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Shape safe to send to a client — never carries the password hash. */
export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone: string | null;
  headline: string | null;
  skills: string[];
};
