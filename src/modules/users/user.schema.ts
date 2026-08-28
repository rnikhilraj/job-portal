import { z } from 'zod';

import { optionalSearchTerm, paginationSchema } from '@/lib/validation';
import { EXPERIENCE_LEVELS } from '@/modules/users/user.constants';

/**
 * Skills arrive either as an array (JSON clients) or as a comma-separated
 * string (the profile form). Both are normalised to a trimmed, de-duplicated,
 * bounded list.
 */
const MAX_SKILLS = 30;
const MAX_SKILL_LENGTH = 40;

const skillsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => (Array.isArray(value) ? value : value.split(',')))
  .transform((values) => {
    const seen = new Set<string>();
    const skills: string[] = [];

    for (const raw of values) {
      const skill = raw.trim().slice(0, MAX_SKILL_LENGTH);
      const key = skill.toLowerCase();
      if (!skill || seen.has(key)) continue;

      seen.add(key);
      skills.push(skill);
    }
    return skills;
  })
  .refine((skills) => skills.length <= MAX_SKILLS, {
    message: `Pick your best ${MAX_SKILLS} — that is plenty.`,
  });

/**
 * Phone numbers are not parsed into a canonical format — international formats
 * vary too much to reject confidently — but the character set is constrained.
 */
const phoneSchema = z
  .string()
  .trim()
  .max(30, 'That is too long for a phone number.')
  .regex(/^[0-9+()\-. ]*$/, 'Digits and + ( ) - . only, please.');

/**
 * Note what is absent: email, role and passwordHash. A candidate cannot change
 * their own role or take over another account by editing their profile.
 *
 * `isSearchable` and `experienceLevel` are candidate-only; the service rejects
 * them for HR accounts rather than silently storing a field HR cannot use.
 */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Your name needs at least 2 characters.').max(120),
    phone: phoneSchema.optional(),
    headline: z.string().trim().max(160, 'Keep your headline under 160 characters.').optional(),
    skills: skillsSchema.optional(),
    isSearchable: z.boolean(),
    experienceLevel: z
      .enum(EXPERIENCE_LEVELS, {
        errorMap: () => ({ message: 'Pick one of the listed experience levels.' }),
      })
      /*
       * An empty string from a <select> means "not specified", stored as unset.
       *
       * It becomes null rather than undefined so that the intent survives the
       * network. The client parses with this same schema and sends the result
       * as JSON, and JSON.stringify drops undefined-valued keys entirely — so
       * mapping to undefined meant the server received no key at all and could
       * not tell "clear this" apart from "leave it alone".
       */
      .or(z.literal('').transform(() => null))
      .nullish(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to save — change something first.',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Query for HR's candidate search.
 *
 * There is deliberately no parameter here that could widen the result set
 * beyond opted-in candidates — the isSearchable filter is applied in the
 * service and is not expressible through the query string.
 */
export const candidateSearchQuerySchema = paginationSchema.extend({
  q: optionalSearchTerm,
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
});

export type CandidateSearchQuery = z.infer<typeof candidateSearchQuerySchema>;
