import type { Types } from 'mongoose';

import { Job, type JobDocument, type JobType, type JobStatus } from '@/modules/jobs/job.model';

let sequence = 0;

export type JobOverrides = Partial<{
  title: string;
  description: string;
  location: string;
  jobType: JobType;
  status: JobStatus;
}>;

export async function createJobFor(
  ownerId: Types.ObjectId | string,
  overrides: JobOverrides = {},
): Promise<JobDocument> {
  sequence += 1;

  return Job.create({
    title: overrides.title ?? `Backend Engineer ${sequence}`,
    description:
      overrides.description ??
      'We are looking for an engineer to build and maintain our services platform.',
    location: overrides.location ?? 'Bengaluru',
    jobType: overrides.jobType ?? 'FULL_TIME',
    status: overrides.status ?? 'OPEN',
    postedBy: ownerId,
  });
}

export const validJobPayload = {
  title: 'Senior Platform Engineer',
  description: 'Own the deployment pipeline and the service mesh for our core products.',
  location: 'Remote (India)',
  jobType: 'FULL_TIME' as const,
};
