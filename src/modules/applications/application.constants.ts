/**
 * Dependency-free application constants.
 *
 * Kept separate from application.model.ts so client components can import them
 * without dragging Mongoose into the browser bundle.
 */
export const APPLICATION_STATUSES = ['APPLIED', 'REVIEWED', 'SHORTLISTED', 'REJECTED'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  REVIEWED: 'Reviewed',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
};
