/**
 * Dependency-free user constants and wire types.
 *
 * Kept separate from user.model.ts so client components can import them without
 * dragging Mongoose into the browser bundle.
 */
export const USER_ROLES = ['HR', 'CANDIDATE'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EXPERIENCE_LEVELS = ['ENTRY', 'MID', 'SENIOR', 'LEAD'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  ENTRY: 'Entry level',
  MID: 'Mid level',
  SENIOR: 'Senior',
  LEAD: 'Lead / Principal',
};

/**
 * The caller's own profile. Carries contact details because it is only ever
 * returned to the account it belongs to — never to another user.
 */
export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone: string | null;
  headline: string | null;
  skills: string[];
  /** Candidate-only. Whether this profile appears in HR's candidate search. */
  isSearchable: boolean;
  /** Candidate-only. Null until the candidate sets it. */
  experienceLevel: ExperienceLevel | null;
};

/**
 * A candidate as seen by HR through the opt-in candidate search.
 *
 * Deliberately narrower than PublicUser: no email, no phone, no application or
 * resume data. Those stay scoped to candidates who actually applied to one of
 * that HR user's listings. Discoverability and contactability are separate
 * things, and opting into search grants only the first.
 */
export type SearchableCandidate = {
  id: string;
  name: string;
  headline: string | null;
  skills: string[];
  experienceLevel: ExperienceLevel | null;
};
