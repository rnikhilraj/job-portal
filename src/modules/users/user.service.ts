import { NotFoundError } from '@/lib/api/errors';
import type { UpdateProfileInput } from '@/modules/users/user.schema';
import { User, toPublicUser, type PublicUser } from '@/modules/users/user.model';

/**
 * Applies a profile update to one user.
 *
 * The caller's own id is passed in from the verified session — it is never read
 * from the request body — so this cannot be pointed at another account. Only
 * the four profile fields are writable; email, role and passwordHash are not
 * part of UpdateProfileInput at all.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Account not found.');

  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.headline !== undefined) user.headline = input.headline;
  if (input.skills !== undefined) user.skills = input.skills;

  await user.save();

  return toPublicUser(user);
}
