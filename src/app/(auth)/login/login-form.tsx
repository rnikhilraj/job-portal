'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/alert';
import { TextField } from '@/components/text-field';
import { ApiRequestError, postJson } from '@/lib/http';
import { loginSchema } from '@/modules/auth/auth.schema';
import type { PublicUser } from '@/modules/users/user.constants';

/** Where each role lands after a successful sign-in. */
function defaultDestination(role: PublicUser['role']): string {
  return role === 'HR' ? '/hr/jobs' : '/jobs';
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // The same schema the API enforces, run early for immediate feedback.
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const user = await postJson<PublicUser>('/api/auth/login', parsed.data);
      router.replace(nextPath ?? defaultDestination(user.role));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Could not reach the server. Please try again.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

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
        autoComplete="current-password"
        required
      />

      <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Log in'}
      </button>
    </form>
  );
}
