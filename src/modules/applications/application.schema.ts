import { z } from 'zod';

import { optionalSearchTerm, paginationSchema } from '@/lib/validation';
import { APPLICATION_STATUSES } from '@/modules/applications/application.model';

/**
 * The resume itself is validated in resume.storage.ts, which inspects the bytes
 * on disk rather than anything the client asserts. This schema covers only the
 * text fields that travel alongside it in the multipart body.
 */
export const applyToJobSchema = z.object({
  coverNote: z
    .string()
    .trim()
    .max(2000, 'Cover note must be 2000 characters or fewer.')
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES, {
    errorMap: () => ({ message: 'Choose a valid application status.' }),
  }),
});

/** Candidate's own applications. */
export const myApplicationsQuerySchema = paginationSchema.extend({
  status: z.enum(APPLICATION_STATUSES).optional(),
});

/** HR view of applicants for one listing, searchable by candidate name. */
export const applicantsQuerySchema = paginationSchema.extend({
  q: optionalSearchTerm,
  status: z.enum(APPLICATION_STATUSES).optional(),
});

export type ApplyToJobInput = z.infer<typeof applyToJobSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type MyApplicationsQuery = z.infer<typeof myApplicationsQuerySchema>;
export type ApplicantsQuery = z.infer<typeof applicantsQuerySchema>;
