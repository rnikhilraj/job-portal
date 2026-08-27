import { z } from 'zod';

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
    message: `List at most ${MAX_SKILLS} skills.`,
  });

/**
 * Phone numbers are not parsed into a canonical format — international formats
 * vary too much to reject confidently — but the character set is constrained.
 */
const phoneSchema = z
  .string()
  .trim()
  .max(30, 'Phone number must be 30 characters or fewer.')
  .regex(/^[0-9+()\-. ]*$/, 'Phone number may only contain digits and + ( ) - . characters.');

/**
 * Note what is absent: email, role and passwordHash. A candidate cannot change
 * their own role or take over another account by editing their profile.
 */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
    phone: phoneSchema.optional(),
    headline: z.string().trim().max(160, 'Headline must be 160 characters or fewer.').optional(),
    skills: skillsSchema.optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
