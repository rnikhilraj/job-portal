import type { FilterQuery, Types } from 'mongoose';

import { ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { containsMatcher } from '@/lib/validation';
import type {
  BrowseJobsQuery,
  CreateJobInput,
  HrJobsQuery,
  UpdateJobInput,
} from '@/modules/jobs/job.schema';
import {
  Job,
  toPublicJob,
  type JobAttributes,
  type JobDocument,
  type PublicJob,
} from '@/modules/jobs/job.model';
import type { UserRole } from '@/modules/users/user.model';

export type PaginatedJobs = { jobs: PublicJob[]; total: number };

export async function createJob(
  input: CreateJobInput,
  postedBy: Types.ObjectId,
): Promise<PublicJob> {
  const job = await Job.create({ ...input, postedBy });
  return toPublicJob(job);
}

/**
 * Loads a job and asserts the caller owns it.
 *
 * A missing job is a 404 and someone else's job is a 403 — the distinction is
 * intentional and matches the brief. It does leak the existence of an id to
 * another HR user, which is an acceptable trade for a clearer error.
 */
export async function findOwnedJobOrFail(
  jobId: string,
  ownerId: Types.ObjectId,
): Promise<JobDocument> {
  const job = await Job.findById(jobId);
  if (!job) throw new NotFoundError('Job listing not found.');

  if (!job.postedBy.equals(ownerId)) {
    throw new ForbiddenError('You can only manage job listings you posted.');
  }

  return job;
}

export async function updateJob(
  jobId: string,
  ownerId: Types.ObjectId,
  input: UpdateJobInput,
): Promise<PublicJob> {
  const job = await findOwnedJobOrFail(jobId, ownerId);
  job.set(input);
  await job.save();
  return toPublicJob(job);
}

/**
 * Detail view. Candidates only ever see OPEN listings; the HR user who owns a
 * listing also sees it while it is CLOSED, which is what the edit page needs.
 */
export async function deleteJob(jobId: string, ownerId: Types.ObjectId): Promise<void> {
  const job = await findOwnedJobOrFail(jobId, ownerId);
  await job.deleteOne();
}

export async function findJobForViewer(
  jobId: string,
  viewer: { id: Types.ObjectId; role: UserRole },
): Promise<PublicJob> {
  const job = await Job.findById(jobId);

  const visible = job && (job.status === 'OPEN' || (viewer.role === 'HR' && job.postedBy.equals(viewer.id)));
  if (!job || !visible) throw new NotFoundError('Job listing not found.');

  return toPublicJob(job);
}

/** Candidate-facing search across open listings. */
export async function browseJobs(query: BrowseJobsQuery): Promise<PaginatedJobs> {
  const filter: FilterQuery<JobAttributes> = { status: 'OPEN' };

  if (query.q) {
    const matcher = containsMatcher(query.q);
    filter.$or = [{ title: matcher }, { description: matcher }];
  }
  if (query.location) filter.location = containsMatcher(query.location);
  if (query.jobType) filter.jobType = query.jobType;

  return paginate(filter, query.page, query.limit);
}

/** An HR user's own listings, searchable by title and filterable by status. */
export async function listJobsForOwner(
  ownerId: Types.ObjectId,
  query: HrJobsQuery,
): Promise<PaginatedJobs> {
  const filter: FilterQuery<JobAttributes> = { postedBy: ownerId };

  if (query.q) filter.title = containsMatcher(query.q);
  if (query.status) filter.status = query.status;

  return paginate(filter, query.page, query.limit);
}

async function paginate(
  filter: FilterQuery<JobAttributes>,
  page: number,
  limit: number,
): Promise<PaginatedJobs> {
  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Job.countDocuments(filter),
  ]);

  return { jobs: jobs.map(toPublicJob), total };
}
