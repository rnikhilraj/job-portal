import { ProfileForm } from '@/components/profile-form';
import { PageHeader } from '@/components/page-header';
import { ProfileResume } from '@/components/profile-resume';
import { getEnv } from '@/lib/env';
import { requirePageUser } from '@/modules/auth/session';
import { toPublicUser } from '@/modules/users/user.model';

// Bare title: the root layout applies the `%s · Shortlist` template, so a
// brand suffix here would render as "Profile · Shortlist · Shortlist".
export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await requirePageUser();
  const profile = toPublicUser(user);

  return (
    <>
      <PageHeader
        eyebrow="Your details"
        title="Your profile"
        lede="This is what a recruiter sees next to your application."
      />

      <div className="enter-2 space-y-6">
        {profile.role === 'CANDIDATE' ? (
          <ProfileResume
            resume={profile.resume}
            maxResumeBytes={getEnv().MAX_RESUME_BYTES}
            isSearchable={profile.isSearchable}
          />
        ) : null}

        <ProfileForm user={profile} />
      </div>
    </>
  );
}
