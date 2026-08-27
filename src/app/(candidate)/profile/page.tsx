import { ProfileForm } from '@/components/profile-form';
import { requirePageUser } from '@/modules/auth/session';
import { toPublicUser } from '@/modules/users/user.model';

export const metadata = { title: 'Profile · Job Application Tracker' };

export default async function ProfilePage() {
  const user = await requirePageUser();

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Your profile</h1>
      <p className="mb-6 text-sm text-slate-600">
        HR sees these details next to your applications.
      </p>
      <ProfileForm user={toPublicUser(user)} />
    </>
  );
}
