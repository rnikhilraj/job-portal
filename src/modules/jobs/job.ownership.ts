import type { Types } from 'mongoose';

import { ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { Job, type JobDocument } from '@/modules/jobs/job.model';

/**
 * The listing-ownership check, extracted so the two services that need it do
 * not have to import each other.
 *
 * `job.service` cascades a delete into `application.service`, and
 * `application.service` needs this check before it will show an applicant
 * pipeline or hand over a resume. Those two facts used to make the modules
 * mutually dependent, which resolved only because ESM hoists function
 * declarations — a cycle that happened to work rather than one that was
 * designed. Both now depend on this module instead, and neither depends on the
 * other.
 *
 * It lives with the jobs domain because ownership is a property of a listing,
 * and it touches only the Job model, so nothing here can pull the application
 * layer back in.
 */

/**
 * Loads a listing and asserts the caller owns it.
 *
 * A missing listing is a 404 and someone else's is a 403. The distinction is
 * intentional and matches the brief: it does reveal that an id exists to
 * another HR user, which is an acceptable trade for an error that says what is
 * actually wrong.
 */
export async function findOwnedJobOrFail(
  jobId: string,
  ownerId: Types.ObjectId,
): Promise<JobDocument> {
  const job = await Job.findById(jobId);
  if (!job) throw new NotFoundError('We could not find that listing.');

  if (!job.postedBy.equals(ownerId)) {
    throw new ForbiddenError('You can only change listings you posted.');
  }

  return job;
}
