import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Schema } from 'mongoose';

import { BadRequestError, NotFoundError } from '@/lib/api/errors';
import { getEnv } from '@/lib/env';

/**
 * An uploaded PDF resume: its metadata, its validation rules and its place on
 * disk. This lives in lib/ rather than a domain module because two domains
 * embed it — an application carries the resume sent for that job, and a
 * candidate profile carries a general one for recruiter search.
 */
export interface ResumeFile {
  /** Random server-generated filename on disk — never anything the client sent. */
  storedName: string;
  /** Sanitised original filename, kept only to label the download. */
  originalName: string;
  sizeBytes: number;
  contentType: string;
}

/** Embedded sub-document shared by the Application and User models. */
export const resumeFileSchema = new Schema<ResumeFile>(
  {
    storedName: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    sizeBytes: { type: Number, required: true },
    contentType: { type: String, required: true },
  },
  { _id: false },
);

const PDF_MAGIC_BYTES = '%PDF-';
const PDF_CONTENT_TYPE = 'application/pdf';
const MAX_ORIGINAL_NAME_LENGTH = 120;

/** Control characters, which have no place in a filename echoed back in a header. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

function uploadsRoot(): string {
  return path.resolve(getEnv().UPLOADS_DIR);
}

/**
 * Reduces a client-supplied filename to something safe to store as a label and
 * echo back in a Content-Disposition header. Any directory component is
 * discarded, and only a conservative character set survives.
 *
 * This value is never used to build a path — see storedName for that.
 */
export function sanitizeOriginalName(rawName: string): string {
  const withoutPath = rawName.split(/[\\/]/).pop() ?? '';
  const cleaned = withoutPath
    .replace(CONTROL_CHARACTERS, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/^\.+/, '')
    .trim();

  const base = cleaned.slice(0, MAX_ORIGINAL_NAME_LENGTH) || 'resume.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Rejects an upload that is not a PDF.
 *
 * The browser-declared content type is checked, but it is attacker-controlled,
 * so the decisive test is the file's own leading bytes. Renaming `payload.exe`
 * to `resume.pdf` fails here.
 */
function assertIsPdf(declaredType: string, bytes: Buffer): void {
  if (declaredType !== PDF_CONTENT_TYPE) {
    throw new BadRequestError('Only PDF resumes are accepted.');
  }

  const header = bytes.subarray(0, PDF_MAGIC_BYTES.length).toString('latin1');
  if (header !== PDF_MAGIC_BYTES) {
    throw new BadRequestError('That file is not a valid PDF.');
  }
}

/** Guards against a request that would blow up memory during multipart parsing. */
export function assertContentLengthWithinLimit(contentLength: string | null): void {
  const { MAX_RESUME_BYTES } = getEnv();
  if (!contentLength) return;

  const declared = Number(contentLength);
  // Allow slack for multipart boundaries and the cover note field.
  if (Number.isFinite(declared) && declared > MAX_RESUME_BYTES + 16 * 1024) {
    throw new BadRequestError(
      `Resume must be ${Math.floor(MAX_RESUME_BYTES / (1024 * 1024))} MB or smaller.`,
    );
  }
}

/**
 * Validates an uploaded resume and writes it under a random filename.
 *
 * The stored name is a UUID generated here, so a client cannot influence the
 * path on disk at all — no traversal, no overwriting another candidate's file,
 * no executable extension.
 */
export async function storeResume(file: File): Promise<ResumeFile> {
  const { MAX_RESUME_BYTES } = getEnv();
  const maxMegabytes = Math.floor(MAX_RESUME_BYTES / (1024 * 1024));

  if (file.size === 0) {
    throw new BadRequestError('The uploaded resume is empty.');
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw new BadRequestError(`Resume must be ${maxMegabytes} MB or smaller.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Re-check after buffering: the real byte count is what lands on disk.
  if (bytes.byteLength > MAX_RESUME_BYTES) {
    throw new BadRequestError(`Resume must be ${maxMegabytes} MB or smaller.`);
  }

  assertIsPdf(file.type, bytes);

  const storedName = `${randomUUID()}.pdf`;
  const root = uploadsRoot();
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, storedName), bytes, { mode: 0o640 });

  return {
    storedName,
    originalName: sanitizeOriginalName(file.name),
    sizeBytes: bytes.byteLength,
    contentType: PDF_CONTENT_TYPE,
  };
}

/**
 * Resolves a stored resume to an absolute path, refusing anything that escapes
 * the uploads directory. Stored names are server-generated UUIDs, so this is
 * defence in depth against a corrupted or hand-edited database record.
 */
function resolveStoredPath(storedName: string): string {
  const root = uploadsRoot();
  const resolved = path.resolve(root, storedName);

  if (resolved !== path.join(root, path.basename(resolved))) {
    throw new NotFoundError('Resume file not found.');
  }
  return resolved;
}

export async function readResume(storedName: string): Promise<Buffer> {
  try {
    return await fs.readFile(resolveStoredPath(storedName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFoundError('Resume file not found.');
    }
    throw error;
  }
}

/** Best-effort cleanup; a missing file must not fail the surrounding operation. */
export async function deleteResume(storedName: string): Promise<void> {
  try {
    await fs.unlink(resolveStoredPath(storedName));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error(`[resume] failed to delete ${storedName}`, error);
    }
  }
}

/**
 * Headers for serving a stored resume.
 *
 * Shared by both download routes so the protections cannot drift apart: the
 * filename is quoted and percent-encoded (it is already sanitised on upload,
 * but this closes off header injection for good), and the response is
 * attachment-only, un-sniffable, uncacheable by proxies and inert under CSP.
 */
export function resumeDownloadHeaders(originalName: string, byteLength: number): HeadersInit {
  const asciiFallback = originalName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

  return {
    'Content-Type': 'application/pdf',
    'Content-Length': String(byteLength),
    'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
}
