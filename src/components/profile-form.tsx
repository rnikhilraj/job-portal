'use client';

import { useState } from 'react';

import { Alert } from '@/components/alert';
import { TextField } from '@/components/text-field';
import { ApiRequestError, patchJson } from '@/lib/http';
import type { PublicUser } from '@/modules/users/user.constants';
import { updateProfileSchema } from '@/modules/users/user.schema';

export function ProfileForm({ user }: { user: PublicUser }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [headline, setHeadline] = useState(user.headline ?? '');
  const [skills, setSkills] = useState(user.skills.join(', '));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSavedAt(null);

    const parsed = updateProfileSchema.safeParse({ name, phone, headline, skills });
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
      setSavedAt(new Date().toLocaleTimeString());
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Could not reach the server. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {savedAt ? <Alert tone="success">Profile saved at {savedAt}.</Alert> : null}

      <div>
        <span className="field-label">Email</span>
        <p className="text-sm text-slate-600">
          {user.email}
          <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">{user.role}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Email and role cannot be changed from this page.
        </p>
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
        hint="A short line describing what you do. Shown to HR alongside your application."
      />

      <TextField
        label="Skills"
        name="skills"
        value={skills}
        onChange={setSkills}
        errors={fieldErrors.skills}
        placeholder="TypeScript, React, MongoDB"
        hint="Comma-separated. Duplicates are removed automatically."
      />

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
