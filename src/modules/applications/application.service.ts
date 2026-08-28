import type { FilterQuery, Types } from 'mongoose';

import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { containsMatcher } from '@/lib/validation';
import {
  Application,
  type ApplicationAttributes,
  type ApplicationDocument,
  type ApplicationStatus,
} from '@/modules/applications/application.model';
import type {
  ApplicantsQuery,
  MyApplicationsQuery,
} from '@/modules/applications/application.schema';
import { deleteResume, storeResume } from '@/lib/resume-storage';
import { Job, type JobType } from '@/modules/jobs/job.model';
import { findOwnedJobOrFail } from '@/modules/jobs/job.service';
import { User, type UserDocument } from '@/modules/users/user.model';

/** What a candidate sees on "My applications". */
export type PublicApplication = {
  id: string;
  status: ApplicationStatus;
  coverNote: string | null;
  appliedAt: string;
  updatedAt: string;
  resume: { originalName: string; sizeBytes: number };
  job: {
    id: string;
    title: string;
    location: string;
    jobType: JobType;
    isOpen: boolean;
  } | null;
};

/** What HR sees on a listing's applicants page. */
export type PublicApplicant = {
  id: string;
  status: ApplicationStatus;
  coverNote: string | null;
  appliedAt: string;
  resume: { originalName: string; sizeBytes: number };
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    headline: string | null;
    skills: string[];
  } | null;
};

type PopulatedJob = {
  _id: Types.ObjectId;
  title: string;
  location: string;
  jobType: JobType;
  status: string;
};
type PopulatedCandidate = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  headline?: string;
  skills?: string[];
};

export type ApplyToJobParams = {
  jobId: string;
  candidateId: Types.ObjectId;
  coverNote?: string;
  file: File;
};

/**
 * Creates an application, writing the resume to disk only after the job and the
 * duplicate check have passed, and cleaning the file up if the insert fails.
 */
export async function applyToJob(params: ApplyToJobParams): Promise<PublicApplication> {
  const job = await Job.findOne({ _id: params.jobId, status: 'OPEN' });
  if (!job) {
    throw new NotFoundError('This job listing is no longer accepting applications.');
  }

  const alreadyApplied = await Application.exists({ job: job._id, candidate: params.candidateId });
  if (alreadyApplied) {
    throw new ConflictError('You have already applied to this job.');
  }

  const resume = await storeResume(params.file);

  try {
    const application = await Application.create({
      job: job._id,
      candidate: params.candidateId,
      coverNote: params.coverNote,
      resume,
      status: 'APPLIED',
    });

    return {
      id: String(application._id),
      status: application.status,
      coverNote: application.coverNote ?? null,
      appliedAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      resume: { originalName: resume.originalName, sizeBytes: resume.sizeBytes },
      job: {
        id: String(job._id),
        title: job.title,
        location: job.location,
        jobType: job.jobType,
        isOpen: job.status === 'OPEN',
      },
    };
  } catch (error) {
    // Do not leave an orphaned file behind if the insert failed — including the
    // unique-index race where two submissions arrive at the same moment.
    await deleteResume(resume.storedName);

    if (isDuplicateKeyError(error)) {
      throw new ConflictError('You have already applied to this job.');
    }
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/** Used by the job detail page to swap the apply form for an "applied" notice. */
export async function findCandidateApplicationForJob(
  jobId: string,
  candidateId: Types.ObjectId,
): Promise<{ id: string; status: ApplicationStatus } | null> {
  const application = await Application.findOne({ job: jobId, candidate: candidateId }).select(
    'status',
  );
  if (!application) return null;

  return { id: String(application._id), status: application.status };
}

export async function listApplicationsForCandidate(
  candidateId: Types.ObjectId,
  query: MyApplicationsQuery,
): Promise<{ applications: PublicApplication[]; total: number }> {
  const filter: FilterQuery<ApplicationAttributes> = { candidate: candidateId };
  if (query.status) filter.status = query.status;

  const [documents, total] = await Promise.all([
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate<{ job: PopulatedJob }>('job', 'title location jobType status'),
    Application.countDocuments(filter),
  ]);

  return {
    total,
    applications: documents.map((application) => {
      const job = application.job as unknown as PopulatedJob | null;
      return {
        id: String(application._id),
        status: application.status,
        coverNote: application.coverNote ?? null,
        appliedAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        resume: {
          originalName: application.resume.originalName,
          sizeBytes: application.resume.sizeBytes,
        },
        job: job
          ? {
              id: String(job._id),
              title: job.title,
              location: job.location,
              jobType: job.jobType,
              isOpen: job.status === 'OPEN',
            }
          : null,
      };
    }),
  };
}

/**
 * Applicants for one listing. Ownership is checked first, so an HR user cannot
 * read another HR user's applicant pipeline.
 */
export async function listApplicantsForJob(
  jobId: string,
  ownerId: Types.ObjectId,
  query: ApplicantsQuery,
): Promise<{ applicants: PublicApplicant[]; total: number }> {
  const job = await findOwnedJobOrFail(jobId, ownerId);

  const filter: FilterQuery<ApplicationAttributes> = { job: job._id };
  if (query.status) filter.status = query.status;

  if (query.q) {
    // Restrict the name search to people who actually applied to this listing,
    // rather than scanning the whole users collection.
    const candidateIds = await Application.distinct('candidate', { job: job._id });
    const matches = await User.find({
      _id: { $in: candidateIds },
      name: containsMatcher(query.q),
    }).select('_id');

    filter.candidate = { $in: matches.map((user) => user._id) };
  }

  const [documents, total] = await Promise.all([
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate<{ candidate: PopulatedCandidate }>(
        'candidate',
        'name email phone headline skills',
      ),
    Application.countDocuments(filter),
  ]);

  return {
    total,
    applicants: documents.map((application) => {
      const candidate = application.candidate as unknown as PopulatedCandidate | null;
      return {
        id: String(application._id),
        status: application.status,
        coverNote: application.coverNote ?? null,
        appliedAt: application.createdAt.toISOString(),
        resume: {
          originalName: application.resume.originalName,
          sizeBytes: application.resume.sizeBytes,
        },
        candidate: candidate
          ? {
              id: String(candidate._id),
              name: candidate.name,
              email: candidate.email,
              phone: candidate.phone ?? null,
              headline: candidate.headline ?? null,
              skills: candidate.skills ?? [],
            }
          : null,
      };
    }),
  };
}

/** Loads an application and asserts the caller is the HR user who owns its job. */
async function findApplicationOwnedByHr(
  applicationId: string,
  hrId: Types.ObjectId,
): Promise<ApplicationDocument> {
  const application = await Application.findById(applicationId);
  if (!application) throw new NotFoundError('Application not found.');

  // Throws 403 when the listing belongs to a different HR user.
  await findOwnedJobOrFail(String(application.job), hrId);

  return application;
}

export async function updateApplicationStatus(
  applicationId: string,
  hrId: Types.ObjectId,
  status: ApplicationStatus,
): Promise<{ id: string; status: ApplicationStatus }> {
  const application = await findApplicationOwnedByHr(applicationId, hrId);

  application.status = status;
  await application.save();

  return { id: String(application._id), status: application.status };
}

/**
 * Resolves the resume a caller is allowed to download: the HR user who owns the
 * listing, or the candidate who submitted it. Anyone else gets a 403.
 */
export async function findResumeForViewer(
  applicationId: string,
  viewer: UserDocument,
): Promise<{ storedName: string; originalName: string }> {
  const application = await Application.findById(applicationId);
  if (!application) throw new NotFoundError('Application not found.');

  if (viewer.role === 'HR') {
    await findOwnedJobOrFail(String(application.job), viewer._id);
  } else if (!application.candidate.equals(viewer._id)) {
    throw new ForbiddenError('You can only download your own resume.');
  }

  return {
    storedName: application.resume.storedName,
    originalName: application.resume.originalName,
  };
}

/**
 * Removes every application to a job together with its stored resume. Called
 * when a listing is deleted so no orphaned files accumulate on the volume.
 */
export async function deleteApplicationsForJob(jobId: Types.ObjectId): Promise<number> {
  const applications = await Application.find({ job: jobId }).select('resume.storedName');

  await Promise.all(
    applications.map((application) => deleteResume(application.resume.storedName)),
  );
  await Application.deleteMany({ job: jobId });

  return applications.length;
}
