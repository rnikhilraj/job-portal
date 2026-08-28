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
          <Heading className="font-display text-display-sm font-semibold">
            {linkToDetail ? (
              <Link href={`/hr/candidates/${candidate.id}`} className="hover:text-petrol-700">
                {candidate.name}
              </Link>
            ) : (
              candidate.name
            )}
          </Heading>
          {candidate.headline ? (
            <p className="mt-1.5 text-sm text-ink-soft">{candidate.headline}</p>
          ) : null}

          <p className="mt-2 break-words text-sm text-ink-muted">
            <a href={`mailto:${candidate.email}`} className="link">
              {candidate.email}
            </a>
            {candidate.phone ? <span className="ml-2">· {candidate.phone}</span> : null}
          </p>
        </div>

        {candidate.experienceLevel ? (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-petrol-50
              px-2.5 py-1 text-[0.8125rem] font-medium text-petrol-700"
          >
            <span aria-hidden="true" className="text-[0.625rem]">
              ◆
            </span>
            {EXPERIENCE_LEVEL_LABELS[candidate.experienceLevel]}
          </span>
        ) : null}
      </div>

      {candidate.skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {candidate.skills.map((skill) => (
            <li key={skill} className="rounded-md bg-mist-200 px-2 py-0.5 text-xs text-ink-soft">
              {skill}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 border-t border-mist-200 pt-4 text-sm">
        {candidate.resume ? (
          // Authorized handler, not a public file path: the link stops working
          // the moment this candidate opts out.
          <>
            <a href={`/api/candidates/${candidate.id}/resume`} className="link">
              <span aria-hidden="true">↓</span> {candidate.resume.originalName}
            </a>
            <span className="ml-2 text-xs text-ink-faint">
              {formatSize(candidate.resume.sizeBytes)}
            </span>
          </>
        ) : (
          <span className="text-ink-faint">No resume uploaded.</span>
        )}
      </p>
    </>
  );
}
