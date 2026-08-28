import Link from 'next/link';

import { EXPERIENCE_LEVEL_LABELS, type DiscoverableCandidate } from '@/modules/users/user.constants';

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders an opted-in candidate for HR.
 *
 * It takes a DiscoverableCandidate specifically, which by construction can only
 * exist for a candidate who has opted in — so there is no visibility decision
 * to make here, and no chance of this component being pointed at someone who
 * has not consented.
 */
export function CandidateSummary({
  candidate,
  headingLevel = 'h1',
  linkToDetail = true,
}: {
  candidate: DiscoverableCandidate;
  headingLevel?: 'h1' | 'h2';
  linkToDetail?: boolean;
}) {
  const Heading = headingLevel;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading className="text-lg font-semibold">
            {linkToDetail ? (
              <Link href={`/hr/candidates/${candidate.id}`} className="hover:text-brand-600">
                {candidate.name}
              </Link>
            ) : (
              candidate.name
            )}
          </Heading>
          {candidate.headline ? (
            <p className="mt-1 text-sm text-slate-700">{candidate.headline}</p>
          ) : null}

          <p className="mt-2 text-sm text-slate-600">
            <a href={`mailto:${candidate.email}`} className="text-brand-600 hover:underline">
              {candidate.email}
            </a>
            {candidate.phone ? <span className="ml-2">· {candidate.phone}</span> : null}
          </p>
        </div>

        {candidate.experienceLevel ? (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {EXPERIENCE_LEVEL_LABELS[candidate.experienceLevel]}
          </span>
        ) : null}
      </div>

      {candidate.skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {candidate.skills.map((skill) => (
            <li key={skill} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {skill}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-sm">
        {candidate.resume ? (
          // Authorized handler, not a public file path: the link stops working
          // the moment this candidate opts out.
          <a
            href={`/api/candidates/${candidate.id}/resume`}
            className="font-medium text-brand-600 hover:underline"
          >
            Download resume ({candidate.resume.originalName})
          </a>
        ) : (
          <span className="text-slate-500">No resume uploaded.</span>
        )}
        {candidate.resume ? (
          <span className="ml-2 text-xs text-slate-500">
            {formatSize(candidate.resume.sizeBytes)}
          </span>
        ) : null}
      </p>
    </>
  );
}
