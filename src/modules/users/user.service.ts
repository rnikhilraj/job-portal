import type { FilterQuery } from 'mongoose';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { deleteResume, storeResume, type ResumeFile } from '@/lib/resume-storage';
import { containsMatcher } from '@/lib/validation';
import type { CandidateSearchQuery, UpdateProfileInput } from '@/modules/users/user.schema';
import {
  User,
  toDiscoverableCandidate,
  toPublicUser,
  type DiscoverableCandidate,
  type PublicUser,
  type UserAttributes,
} from '@/modules/users/user.model';

/**
 * The one filter that defines the whole recruiter-visible boundary.
 *
 * Every read that exposes a candidate to a recruiter — the search list, the
 * detail view and the resume download — starts from this object. It is a
 * function rather than a shared constant so no caller can mutate it, and it is
 * spread first in each query so a later key cannot silently override it.
 */
function optedInCandidateFilter(): FilterQuery<UserAttributes> {
  return { role: 'CANDIDATE', isSearchable: true };
}

/**
 * Fields loaded for a recruiter-visible candidate. `role` and `isSearchable`
 * are included because toDiscoverableCandidate() re-checks them.
 */
const DISCOVERABLE_FIELDS = 'name headline skills experienceLevel email phone resume role isSearchable';

/** Fields only a candidate account may set. */
const CANDIDATE_ONLY_FIELDS = ['isSearchable', 'experienceLevel'] as const;

/**
 * Applies a profile update to one user.
 *
 * The caller's own id is passed in from the verified session — it is never read
 * from the request body — so this cannot be pointed at another account. Only
 * the profile fields are writable; email, role and passwordHash are not part of
 * UpdateProfileInput at all.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Account not found.');

  if (user.role !== 'CANDIDATE') {
    const offending = CANDIDATE_ONLY_FIELDS.filter((field) => input[field] !== undefined);
    if (offending.length > 0) {
      throw new BadRequestError(
        'These fields apply to candidate accounts only.',
        Object.fromEntries(
          offending.map((field) => [field, ['Only candidate accounts can set this.']]),
        ),
      );
    }
  }

  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.headline !== undefined) user.headline = input.headline;
  if (input.skills !== undefined) user.skills = input.skills;
  if (input.isSearchable !== undefined) user.isSearchable = input.isSearchable;

  // null means "the user chose Not specified" and clears the field; undefined
  // means the request did not mention it at all and it is left alone. Testing
  // the value rather than key presence matters, because a key whose value is
  // undefined does not survive JSON.stringify on the way here.
  if (input.experienceLevel !== undefined) {
    user.set('experienceLevel', input.experienceLevel ?? undefined);
  }

  await user.save();

  return toPublicUser(user);
}

export type CandidateSearchResult = { candidates: DiscoverableCandidate[]; total: number };

/**
 * HR's opt-in candidate search.
 *
 * `role` and `isSearchable` are pinned here, in the query itself, and nothing in
 * CandidateSearchQuery can override them. A candidate who has not opted in is
 * therefore never loaded from the database — not fetched and filtered out later,
 * and not merely hidden by the UI. Turning the toggle off removes them from
 * results immediately, because this reads live state on every request.
 *
 * Results are projected through toDiscoverableCandidate(), which is the only
 * constructor for the shape carrying contact details and throws rather than
 * redacting if it is ever handed a user who is not an opted-in candidate. Email,
 * phone and the profile resume ARE part of that shape — exposing them is what
 * opting in grants — so the guarantee here is that they cannot be built for
 * anyone who has not opted in, not that they stay inside the service.
 */
export async function searchCandidates(
  query: CandidateSearchQuery,
): Promise<CandidateSearchResult> {
  const filter: FilterQuery<UserAttributes> = optedInCandidateFilter();

  if (query.experienceLevel) filter.experienceLevel = query.experienceLevel;

  if (query.q) {
    // Escaped before it becomes a RegExp — same rule as the job search, so a
    // term like `.*` matches literally instead of matching everything.
    const matcher = containsMatcher(query.q);
    filter.$or = [{ name: matcher }, { headline: matcher }, { skills: matcher }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(DISCOVERABLE_FIELDS)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    User.countDocuments(filter),
  ]);

  return { candidates: users.map(toDiscoverableCandidate), total };
}

/**
 * One candidate's recruiter-visible profile.
 *
 * A candidate who is not opted in is reported as not found rather than
 * forbidden: to a recruiter holding a stale id, an opted-out profile and a
 * deleted one should be indistinguishable.
 */
export async function findDiscoverableCandidate(
  candidateId: string,
): Promise<DiscoverableCandidate> {
  const user = await User.findOne({ ...optedInCandidateFilter(), _id: candidateId }).select(
    DISCOVERABLE_FIELDS,
  );
  if (!user) throw new NotFoundError('Candidate not found.');

  return toDiscoverableCandidate(user);
}

/**
 * Resolves a candidate's general resume for a recruiter.
 *
 * The opt-in is re-checked here, at request time, against live state — a link
 * handed out or bookmarked while the candidate was discoverable stops working
 * the moment they opt out. 403 rather than 404 because the caller may well have
 * had legitimate access a minute ago, and saying so is more honest than
 * pretending the record never existed.
 */
export async function findCandidateResumeForRecruiter(
  candidateId: string,
): Promise<ResumeFile> {
  const user = await User.findOne({ _id: candidateId, role: 'CANDIDATE' }).select(
    'resume isSearchable',
  );
  if (!user) throw new NotFoundError('Candidate not found.');

  if (!user.isSearchable) {
    throw new ForbiddenError('This candidate is not visible to recruiters.');
  }
  if (!user.resume) {
    throw new NotFoundError('This candidate has not uploaded a resume.');
  }

  return user.resume;
}

/**
 * Stores or replaces the caller's own general resume.
 *
 * The previous file is deleted after the new one is recorded, so a failed
 * write never destroys the resume that is still referenced.
 */
export async function replaceOwnResume(userId: string, file: File): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Account not found.');

  if (user.role !== 'CANDIDATE') {
    throw new ForbiddenError('Only candidate accounts can upload a profile resume.');
  }

  const previous = user.resume?.storedName;
  const stored = await storeResume(file);

  try {
    user.resume = stored;
    await user.save();
  } catch (error) {
    // Roll back the orphaned upload rather than leave it on the volume.
    await deleteResume(stored.storedName);
    throw error;
  }

  if (previous && previous !== stored.storedName) {
    await deleteResume(previous);
  }

  return toPublicUser(user);
}

export async function removeOwnResume(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Account not found.');

  const previous = user.resume?.storedName;
  if (!previous) throw new NotFoundError('You have no uploaded resume to remove.');

  user.set('resume', undefined);
  await user.save();
  await deleteResume(previous);

  return toPublicUser(user);
}

/**
 * The caller's own resume, for the download link on their profile page.
 *
 * Deliberately not gated on isSearchable: that flag governs what recruiters can
 * see, not whether someone may read back a file they uploaded themselves.
 */
export async function findOwnResume(userId: string): Promise<ResumeFile> {
  const user = await User.findById(userId).select('resume');
  if (!user?.resume) throw new NotFoundError('You have not uploaded a resume.');

  return user.resume;
}
