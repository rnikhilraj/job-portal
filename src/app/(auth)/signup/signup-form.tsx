'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/alert';
import { TextField } from '@/components/text-field';
import { ApiRequestError, postJson } from '@/lib/http';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { signupSchema } from '@/modules/auth/auth.schema';
import type { PublicUser } from '@/modules/users/user.constants';

/** Signup always creates a candidate, so there is one default destination. */
const DEFAULT_DESTINATION = '/jobs';

export function SignupForm() {
  const router = useRouter();
  // Signup honours `next` for the same reason login does: someone deep-linked
  // to a role, sent to the auth pages and choosing to create an account rather
  // than sign in, should still land where they were going. Validated through
  // the same helper — an unchecked value here would be the identical bug.
  const searchParams = useSearchParams();
  const nextPath = safeRedirectPath(searchParams.get('next'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = signupSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await postJson<PublicUser>('/api/auth/signup', parsed.data);
      router.replace(nextPath ?? DEFAULT_DESTINATION);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Could not reach the server — no account was created. Try again in a moment.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

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
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={setEmail}
        errors={fieldErrors.email}
        autoComplete="email"
        required
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        errors={fieldErrors.password}
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number in there somewhere."
        required
      />

      <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Setting you up…' : 'Create my account'}
      </button>
    </form>
  );
}
