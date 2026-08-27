/**
 * Dependency-free job constants and wire types.
 *
 * Kept separate from job.model.ts so client components can import them without
 * dragging Mongoose into the browser bundle.
 */
export const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['OPEN', 'CLOSED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: 'Full time',
  PART_TIME: 'Part time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  REMOTE: 'Remote',
};

export type PublicJob = {
  id: string;
  title: string;
  description: string;
  location: string;
  jobType: JobType;
  status: JobStatus;
  postedBy: string;
  createdAt: string;
  updatedAt: string;
};
