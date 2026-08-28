import type { FilterQuery } from 'mongoose';

import { BadRequestError, NotFoundError } from '@/lib/api/errors';
import { containsMatcher } from '@/lib/validation';
import type { CandidateSearchQuery, UpdateProfileInput } from '@/modules/users/user.schema';
import {
  User,
  toPublicUser,
  toSearchableCandidate,
  type PublicUser,
  type SearchableCandidate,
  type UserAttributes,
} from '@/modules/users/user.model';

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

  // Presence of the key, not its value, decides here: the schema maps the form's
  // empty option to undefined, which must clear a previously set level rather
  // than leave it stale.
  if ('experienceLevel' in input) {
    user.set('experienceLevel', input.experienceLevel);
  }

  await user.save();

  return toPublicUser(user);
}

export type CandidateSearchResult = { candidates: SearchableCandidate[]; total: number };

/**
 * HR's opt-in candidate search.
 *
 * `role` and `isSearchable` are pinned here, in the query itself, and nothing in
 * CandidateSearchQuery can override them. A candidate who has not opted in is
 * therefore never loaded from the database — not fetched and filtered out later,
 * and not merely hidden by the UI. Turning the toggle off removes them from
 * results immediately, because this reads live state on every request.
 *
 * Results are projected through toSearchableCandidate, so email and phone never
 * leave the service even if a future caller forgets to strip them.
 */
export async function searchCandidates(
  query: CandidateSearchQuery,
): Promise<CandidateSearchResult> {
  const filter: FilterQuery<UserAttributes> = { role: 'CANDIDATE', isSearchable: true };

  if (query.experienceLevel) filter.experienceLevel = query.experienceLevel;

  if (query.q) {
    // Escaped before it becomes a RegExp — same rule as the job search, so a
    // term like `.*` matches literally instead of matching everything.
    const matcher = containsMatcher(query.q);
    filter.$or = [{ name: matcher }, { headline: matcher }, { skills: matcher }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name headline skills experienceLevel')
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    User.countDocuments(filter),
  ]);

  return { candidates: users.map(toSearchableCandidate), total };
}
