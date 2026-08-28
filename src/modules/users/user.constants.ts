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
  /** Candidate-only. The general profile resume, if one has been uploaded. */
  resume: ResumeSummary | null;
};

/** Summary of a candidate's uploaded general resume. Never includes the path on disk. */
export type ResumeSummary = {
  originalName: string;
  sizeBytes: number;
};

/**
 * A candidate as seen by HR through the opt-in candidate directory.
 *
 * INVARIANT: a value of this type may only ever be constructed for a candidate
 * whose `isSearchable` is true. The name says "discoverable" rather than
 * "candidate" for that reason — it is not a general-purpose user shape, and it
 * must never be used to render someone who has not opted in.
 *
 * `toDiscoverableCandidate()` in user.model.ts is the only constructor, and it
 * throws rather than returning a partially redacted object if handed a
 * candidate who is not opted in. The queries that feed it pin
 * `isSearchable: true`, so the throw is a backstop against a future caller, not
 * the primary control.
 *
 * Contact details are here because opting in is what grants them. Application
 * history and per-application resumes are NOT here — those stay scoped to
 * candidates who actually applied to that HR user's listings.
 */
export type DiscoverableCandidate = {
  id: string;
  name: string;
  headline: string | null;
  skills: string[];
  experienceLevel: ExperienceLevel | null;
  email: string;
  phone: string | null;
  /** Null when the candidate has not uploaded a general resume. */
  resume: ResumeSummary | null;
};
