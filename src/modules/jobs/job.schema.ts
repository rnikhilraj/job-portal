import { z } from 'zod';

import { optionalSearchTerm, paginationSchema } from '@/lib/validation';
import { JOB_STATUSES, JOB_TYPES } from '@/modules/jobs/job.constants';

export const createJobSchema = z.object({
  title: z.string().trim().min(3, 'Give the role a title of at least 3 characters.').max(140),
  description: z
    .string()
    .trim()
    .min(20, 'Candidates need more than 20 characters to go on.')
    .max(10_000),
  location: z.string().trim().min(2, 'Where is this role based? Remote counts.').max(120),
  jobType: z.enum(JOB_TYPES, {
    errorMap: () => ({ message: 'Pick one of the listed job types.' }),
  }),
  status: z.enum(JOB_STATUSES).default('OPEN'),
});

/** Every field optional, but the request must change at least one of them. */
export const updateJobSchema = createJobSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to save — change something first.',
  });

/** Query for the candidate-facing listing: only OPEN jobs are ever returned. */
export const browseJobsQuerySchema = paginationSchema.extend({
  q: optionalSearchTerm,
  location: optionalSearchTerm,
  jobType: z.enum(JOB_TYPES).optional(),
});

/** Query for an HR user's own listings, which may include CLOSED ones. */
export const hrJobsQuerySchema = paginationSchema.extend({
  q: optionalSearchTerm,
  status: z.enum(JOB_STATUSES).optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type BrowseJobsQuery = z.infer<typeof browseJobsQuerySchema>;
export type HrJobsQuery = z.infer<typeof hrJobsQuerySchema>;
