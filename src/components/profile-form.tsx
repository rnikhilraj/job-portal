'use client';

import { useState } from 'react';

import { Alert } from '@/components/alert';
import { TextField } from '@/components/text-field';
import { ApiRequestError, patchJson } from '@/lib/http';
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  type ExperienceLevel,
  type PublicUser,
} from '@/modules/users/user.constants';
import { updateProfileSchema } from '@/modules/users/user.schema';

export function ProfileForm({ user }: { user: PublicUser }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [headline, setHeadline] = useState(user.headline ?? '');
  const [skills, setSkills] = useState(user.skills.join(', '));
  const [isSearchable, setIsSearchable] = useState(user.isSearchable);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | ''>(
    user.experienceLevel ?? '',
  );

  const isCandidate = user.role === 'CANDIDATE';

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSavedAt(null);

    // The opt-in fields are candidate-only; the API rejects them from an HR
    // account, so they are not sent from one either.
    const parsed = updateProfileSchema.safeParse({
      name,
      phone,
      headline,
      skills,
      ...(isCandidate ? { isSearchable, experienceLevel } : {}),
    });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const updated = await patchJson<PublicUser>('/api/users/me', parsed.data);
      // Re-seed from the server's normalised values rather than local state.
      setName(updated.name);
      setPhone(updated.phone ?? '');
      setHeadline(updated.headline ?? '');
      setSkills(updated.skills.join(', '));
      setIsSearchable(updated.isSearchable);
      setExperienceLevel(updated.experienceLevel ?? '');
      setSavedAt(new Date().toLocaleTimeString());
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Could not reach the server — your profile was not saved. Check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {savedAt ? <Alert tone="success">Saved at {savedAt}. Looking good.</Alert> : null}

      <div>
        <span className="field-label">Email</span>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span className="break-all">{user.email}</span>
          <span
            className="rounded-full bg-petrol-50 px-2 py-0.5 text-[0.6875rem] font-semibold
              uppercase tracking-wide text-petrol-700"
          >
            {user.role}
          </span>
        </p>
        <p className="field-hint">Email and role are fixed — an administrator handles those.</p>
      </div>

      <TextField
        label="Full name"
        name="name"
        value={name}
        onChange={setName}
        errors={fieldErrors.name}
        autoComplete="name"
        required
      />

      <TextField
        label="Phone"
        name="phone"
        type="tel"
        value={phone}
        onChange={setPhone}
        errors={fieldErrors.phone}
        autoComplete="tel"
        placeholder="+91 98765 43210"
      />

      <TextField
        label="Headline"
        name="headline"
        value={headline}
        onChange={setHeadline}
        errors={fieldErrors.headline}
        placeholder="Full-stack engineer"
        hint="One line on what you do. It sits right under your name on a recruiter's screen."
      />

      <TextField
        label="Skills"
        name="skills"
        value={skills}
        onChange={setSkills}
        errors={fieldErrors.skills}
        placeholder="TypeScript, React, MongoDB"
        hint="Comma-separated. We tidy up duplicates and stray spaces for you."
      />

      {isCandidate ? (
        <fieldset className="rounded-card border border-mist-300 bg-mist-100 p-4 sm:p-5">
          <legend className="px-1.5 font-display text-sm font-semibold text-ink">
            Recruiter visibility
          </legend>

          <label htmlFor="isSearchable" className="flex cursor-pointer items-start gap-3">
            <input
              id="isSearchable"
              name="isSearchable"
              type="checkbox"
              checked={isSearchable}
              onChange={(event) => setIsSearchable(event.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-mist-400
                text-petrol-600 accent-petrol-600"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                Make my profile visible to recruiters
              </span>
              <span className="mt-1.5 block text-sm leading-relaxed text-ink-muted">
                HR users will be able to find you by name, headline or skill, and will see your{' '}
                <strong className="font-medium">
                  email address, phone number and uploaded resume
                </strong>{' '}
                along with your experience level. Leave this off and none of it is visible to
                anyone.
              </span>
            </span>
          </label>

          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            {isSearchable
              ? 'You are discoverable right now. Recruiters can see your contact details and download your resume; untick and save to pull all of it back immediately.'
              : "You're invisible to recruiters right now, which is the default and entirely fine. Nothing here is shared with anyone until you say so."}
          </p>

          <div className="mt-4 max-w-xs">
            <label htmlFor="experienceLevel" className="field-label">
              Experience level
            </label>
            <select
              id="experienceLevel"
              name="experienceLevel"
              value={experienceLevel}
              onChange={(event) => setExperienceLevel(event.target.value as ExperienceLevel | '')}
              aria-invalid={Boolean(fieldErrors.experienceLevel?.length)}
              aria-describedby={
                fieldErrors.experienceLevel?.length
                  ? 'experienceLevel-error'
                  : 'experienceLevel-hint'
              }
              className="field-input"
            >
              <option value="">Not specified</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {EXPERIENCE_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
            {fieldErrors.experienceLevel?.length ? (
              <p id="experienceLevel-error" className="field-error">
                {fieldErrors.experienceLevel.join(' ')}
              </p>
            ) : (
              <p id="experienceLevel-hint" className="field-hint">
                Helps recruiters filter by seniority. Optional.
              </p>
            )}
          </div>
        </fieldset>
      ) : null}

      <div className="border-t border-mist-200 pt-5">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save my profile'}
        </button>
      </div>
    </form>
  );
}
