# Job Application Tracker

A full-stack job application tracker with two roles. **Candidates** browse openings, apply with
a PDF resume and follow their status. **HR** users post listings, review the applicants for
their own listings and move them through a hiring pipeline.

Built with Next.js (App Router) serving both the UI and the API, MongoDB via Mongoose, and
JWT sessions in httpOnly cookies. Resumes are stored on a Docker volume, never in the database
and never in a publicly served directory.

---

## Table of contents

- [Quick start](#quick-start)
- [Test credentials](#test-credentials)
- [Architecture](#architecture)
- [Feature walkthrough](#feature-walkthrough)
- [API reference](#api-reference)
- [Security notes](#security-notes)
- [Testing](#testing)
- [Local development without Docker](#local-development-without-docker)
- [Configuration](#configuration)
- [Tech stack](#tech-stack)
- [Known limitations](#known-limitations)

---

## Quick start

Requires Docker with Compose v2. Nothing else — no local Node, no manual database setup, no
seeding step.

```bash
git clone <repository-url>
cd job-portal
cp .env.example .env
docker compose up --build
```

**The UI is on http://localhost:3000.**

The first boot takes a couple of minutes to build the image. When it is ready the app container
logs `[seed] complete` and the health probe answers:

```bash
curl http://localhost:3000/api/health
# {"data":{"status":"ok","database":"connected"}}
```

`.env.example` contains working development defaults, so copying it is enough to get started.
It is committed; `.env` is gitignored and holds no real secrets in this project. For anything
beyond local use, replace `JWT_SECRET` with a generated value:

```bash
openssl rand -base64 48
```

To stop, and to reset all data:

```bash
docker compose down      # stop; database and resumes are preserved
docker compose down -v   # stop and delete both named volumes
```

### Why there is no setup step

`src/instrumentation.ts` runs Next's `register()` hook once at server start. It parses the
environment (so a misconfigured deployment fails on boot rather than on the first request) and,
when `SEED_ON_BOOT=true`, seeds the demo accounts and sample listings. Seeding is idempotent —
restarting the container never overwrites data you have changed.

---

## Test credentials

Seeded automatically on first boot.

| Role | Email | Password |
| --- | --- | --- |
| **HR** | `hr1@example.com` | `Hr@Passw0rd123` |
| HR (second account, to demonstrate isolation) | `hr2@example.com` | `Hr@Passw0rd123` |
| **Candidate** | `candidate@example.com` | `Cand@Passw0rd123` |

HR accounts have **no public signup route**. They exist only via the seed. Anyone can register a
candidate account at `/signup`.

Sign in as `hr2@example.com` to confirm role isolation: HR2 cannot see, edit, delete, or view the
applicants of any listing belonging to HR1.

The seed also creates six listings — four owned by HR1 (one of them `CLOSED`, so the status
filter has something to show) and two owned by HR2.

---

## Architecture

### Request flow

```
Browser
   │
   ├─ page navigation ──────▶ Server Component
   │                            │  requirePageUser() → verifies the session cookie
   │                            │  calls the domain service directly (no HTTP hop)
   │                            ▼
   │                         src/modules/<domain>/*.service.ts
   │                            │
   ├─ fetch() from a ───────▶ Route Handler (src/app/api/**)
   │  client component         │  withRoute() → connect, try/catch, status mapping
   │                           │  requireUser()/requireRole() → 401 / 403
   │                           │  zod schema .parse() → 400 with field details
   │                           ▼
   │                         same service layer
   │                            │
   │                            ├──▶ Mongoose models ──▶ MongoDB (mongo_data volume)
   │                            └──▶ resume.storage.ts ─▶ /app/uploads (resume_uploads volume)
```

Reads that render a page go through server components calling the service layer directly — the
same modules the API routes use, behind the same authorization helpers. Writes always go through
the API routes. Nothing makes an HTTP request to its own API.

### Code layout — organised by domain, not by file type

Each domain owns its model, its validation schemas and its business logic. `src/app/api/` holds
only thin HTTP adapters: parse, authorize, delegate, respond.

```
src/
├── app/
│   ├── (auth)/            login, signup
│   ├── (candidate)/       jobs, jobs/[id], applications, profile
│   ├── (hr)/hr/           jobs, jobs/new, jobs/[id]/edit, jobs/[id]/applicants
│   └── api/               route handlers only — no business logic
│
├── modules/
│   ├── auth/              auth.schema · auth.service · password · jwt · session · cookie
│   ├── users/             user.model · user.schema · user.service
│   ├── jobs/              job.model · job.schema · job.service
│   └── applications/      application.model · application.schema · application.service
│                          · resume.storage
│
├── lib/
│   ├── api/               errors (typed AppError hierarchy) · respond (JSON envelope)
│   │                      · route (withRoute wrapper)
│   ├── db.ts              memoised Mongoose connection
│   ├── env.ts             lazily parsed, zod-validated environment
│   ├── validation.ts      shared pagination, ObjectId and regex-escaping helpers
│   ├── rate-limit.ts      fixed-window limiter for credential endpoints
│   └── seed.ts            idempotent demo data
│
├── components/            shared UI
├── instrumentation.ts     boot hook: validate env, seed
└── middleware.ts          cookie-presence redirects (UX only — see Security notes)
```

### Data model

| Collection | Fields | Indexes |
| --- | --- | --- |
| `users` | `email` (unique, lowercased), `passwordHash` (`select: false`), `role`, `name`, `phone?`, `headline?`, `skills[]` | unique `email` |
| `jobs` | `title`, `description`, `location`, `jobType`, `status`, `postedBy → users` | `{status, createdAt}`, `{postedBy, createdAt}` |
| `applications` | `job → jobs`, `candidate → users`, `status`, `coverNote?`, `resume {storedName, originalName, sizeBytes, contentType}` | **unique `{job, candidate}`** |

`postedBy` is what makes an HR user's listings theirs; every mutation compares it to the caller.
The unique `{job, candidate}` index is what actually prevents duplicate applications — see
[Security notes](#security-notes).

### Response envelope

Every endpoint answers in one of two shapes.

```jsonc
// success
{ "data": { ... }, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }

// failure
{ "error": { "code": "FORBIDDEN", "message": "…", "details": { "field": ["…"] } } }
```

`withRoute()` (`src/lib/api/route.ts`) wraps every handler and is the single place a thrown error
becomes a status code:

| Thrown | Status | `code` |
| --- | --- | --- |
| `ZodError` | 400 | `VALIDATION_ERROR` (with per-field `details`) |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError`, Mongo `E11000` | 409 | `CONFLICT` |
| `RateLimitError` | 429 | `RATE_LIMITED` |
| anything else | 500 | `INTERNAL_ERROR` — logged server-side, generic message to the client |

409 is used for a duplicate signup email and a duplicate application, in preference to a generic
400, because both are conflicts with existing state rather than malformed input.

---

## Feature walkthrough

### As a candidate — `candidate@example.com` / `Cand@Passw0rd123`

1. **Sign up or log in.** `/signup` creates a candidate account; the role is fixed server-side.
2. **Browse jobs** at `/jobs`. Search by keyword across title *and* description, filter by
   location and job type, and page through results. Every filter lives in the URL, so results
   are shareable and the page works without JavaScript.
3. **View a job** at `/jobs/<id>`. Closed listings are not reachable.
4. **Apply.** Attach a PDF (5 MB limit) and an optional cover note. Applying a second time to the
   same listing is refused with a clear message.
5. **Track applications** at `/applications`: status per application (Applied / Reviewed /
   Shortlisted / Rejected), your cover note, and a link to re-download your own resume. Filter by
   status. If HR deletes a listing, the row degrades to "Listing removed" rather than vanishing.
6. **Edit your profile** at `/profile`: name, phone, headline and comma-separated skills. HR sees
   these next to your application. Email and role are not editable.

### As an HR user — `hr1@example.com` / `Hr@Passw0rd123`

1. **Log in** at `/login`. There is no HR signup.
2. **My listings** at `/hr/jobs` — only your own, including closed ones. Search by title, filter
   by status, page through results.
3. **Post a job** at `/hr/jobs/new`: title, description, location, job type, status.
4. **Edit or delete** a listing. Deleting also removes its applications and their resume files;
   the confirmation says so.
5. **View applicants** at `/hr/jobs/<id>/applicants`: each candidate's name, email, phone,
   headline, skills and cover note. Search by candidate name, filter by status.
6. **Download a resume** — served through an authorized handler, not a public URL.
7. **Change a status** with the inline control. If the server rejects the change, the control
   rolls back rather than showing a status that was never saved.

### Confirming role isolation yourself

```bash
# Log in as each account
curl -s -X POST localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"hr1@example.com","password":"Hr@Passw0rd123"}' -c hr1.jar -o /dev/null
curl -s -X POST localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"hr2@example.com","password":"Hr@Passw0rd123"}' -c hr2.jar -o /dev/null
curl -s -X POST localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"candidate@example.com","password":"Cand@Passw0rd123"}' -c cand.jar -o /dev/null

# An OPEN listing owned by HR1 — the newest seeded one is CLOSED, so filter.
JOB=$(curl -s -b hr1.jar 'localhost:3000/api/jobs?scope=mine&status=OPEN' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data'][0]['id'])")

# A candidate hitting an HR-only route          → 403
curl -s -o /dev/null -w '%{http_code}\n' -b cand.jar -X POST localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d '{"title":"Fake","description":"a description long enough to pass","location":"X","jobType":"FULL_TIME"}'

# HR2 editing HR1's listing                     → 403
curl -s -o /dev/null -w '%{http_code}\n' -b hr2.jar -X PATCH localhost:3000/api/jobs/$JOB \
  -H 'content-type: application/json' -d '{"title":"Hijacked"}'

# HR2 reading HR1's applicant pipeline          → 403
curl -s -o /dev/null -w '%{http_code}\n' -b hr2.jar localhost:3000/api/jobs/$JOB/applications

# An executable renamed to resume.pdf           → 400
printf 'MZ not a pdf' > fake.pdf
curl -s -b cand.jar -X POST localhost:3000/api/jobs/$JOB/applications \
  -F 'resume=@fake.pdf;type=application/pdf'

# Applying twice to the same job                → 409 on the second attempt
printf '%%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > real.pdf
curl -s -o /dev/null -w '%{http_code}\n' -b cand.jar -X POST localhost:3000/api/jobs/$JOB/applications \
  -F 'resume=@real.pdf;type=application/pdf'
curl -s -o /dev/null -w '%{http_code}\n' -b cand.jar -X POST localhost:3000/api/jobs/$JOB/applications \
  -F 'resume=@real.pdf;type=application/pdf'
```

---

## API reference

All routes are under `/api`. Every route except `/api/health`, `/api/auth/signup` and
`/api/auth/login` requires a valid session cookie.

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| `GET` | `/health` | public | Liveness probe, also reports database connectivity |
| `POST` | `/auth/signup` | public | Creates a **candidate**; a `role` in the body is ignored. Rate limited |
| `POST` | `/auth/login` | public | Sets the session cookie. Rate limited |
| `POST` | `/auth/logout` | any | Expires the session cookie |
| `GET` | `/auth/me` | any | Current user |
| `GET` | `/users/me` | any | Own profile |
| `PATCH` | `/users/me` | any | Edit own name, phone, headline, skills |
| `GET` | `/jobs` | any | Open listings. `?q=&location=&jobType=&page=&limit=` |
| `GET` | `/jobs?scope=mine` | **HR** | Caller's own listings incl. closed. `?q=&status=` |
| `POST` | `/jobs` | **HR** | Create a listing |
| `GET` | `/jobs/:id` | any | Open listings, plus the owner's own closed ones |
| `PATCH` | `/jobs/:id` | **owner HR** | 404 if missing, 403 if someone else's |
| `DELETE` | `/jobs/:id` | **owner HR** | Cascades to applications and resume files |
| `POST` | `/jobs/:id/applications` | **candidate** | `multipart/form-data`: `resume` (PDF), `coverNote?` |
| `GET` | `/jobs/:id/applications` | **owner HR** | Applicants. `?q=&status=&page=&limit=` |
| `GET` | `/applications` | **candidate** | Own applications. `?status=&page=&limit=` |
| `PATCH` | `/applications/:id` | **owner HR** | `{ "status": "REVIEWED" }` |
| `GET` | `/applications/:id/resume` | **owner HR or the applicant** | Streams the PDF as an attachment |

Enumerations: `jobType` is `FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP | REMOTE`, job `status`
is `OPEN | CLOSED`, application `status` is `APPLIED | REVIEWED | SHORTLISTED | REJECTED`.

Pagination defaults to `page=1&limit=10`; `limit` is capped at 50 and a larger value is a 400.

---

## Security notes

**Authorization is enforced on the server, on every protected route.** `requireUser()` returns
401 without a valid session; `requireRole('HR')` returns 403 for the wrong role. Both re-read the
user from MongoDB rather than trusting the role claim in the JWT, so a deleted or demoted account
cannot keep acting on a still-valid token. Hiding a button in the UI is never the control.

**`src/middleware.ts` is not an authorization boundary, by design.** It runs on the Edge runtime,
where verifying the JWT would mean shipping the signing secret into that bundle, so it only
checks whether a session cookie is present in order to redirect anonymous visitors to the login
page. A forged cookie sails past it and straight into a 401 from the route handler. A test pins
this behaviour so nobody later mistakes it for security.

**Privilege escalation has no surface.** `POST /api/auth/signup` has no `role` field to bind to
and hardcodes `CANDIDATE`. `PATCH /api/users/me` has no `email`, `role` or `passwordHash` field
and always targets the id from the verified session. Both are covered by tests that send the
hostile body and assert nothing changed.

**Passwords.** Hashed with bcrypt at cost 12 and stored on a `select: false` field, so a query has
to opt in explicitly and the public user shape cannot carry the hash. Passwords are capped at 72
characters because bcrypt silently ignores bytes past that point. Login answers with one identical
error for "no such account" and "wrong password", and performs an equivalent bcrypt comparison
against a dummy hash when no user matches, so neither the response nor the timing reveals who is
registered. Both credential endpoints are rate limited.

> The `bcryptjs` package is used rather than the native `bcrypt` binding. It produces the same
> `$2a$` hashes and removes the node-gyp/python toolchain from the Alpine build stage.

**Sessions.** HS256 JWTs signed with `JWT_SECRET` (rejected at under 32 characters), carried in a
cookie that is `httpOnly`, `SameSite=lax`, `Secure` in production, and scoped to `/`.

**Resume uploads never trust the client.**

- The declared content type is checked, but the decisive test is the file's own leading bytes:
  anything not starting with `%PDF-` is rejected. An executable renamed to `resume.pdf` fails.
- The name on disk is a server-generated UUID, so a client cannot influence the path at all.
  `../../../../etc/passwd.pdf` is stored as `<uuid>.pdf` and displayed as `passwd.pdf`.
- The original filename is sanitised to a bounded, control-character-free label used only to title
  the download.
- Size is capped twice: `Content-Length` is rejected before the body is parsed, so an oversized
  upload is never buffered into memory, and the real byte count is re-checked afterwards.
- Reads resolve the path and assert it is still inside the uploads directory — defence in depth
  against a tampered database record.
- If the database insert fails after the file is written, the file is deleted, so a rejected
  duplicate leaves nothing behind.

**Resumes are served through an authorized route handler, never from a public directory**, so the
permission check cannot be bypassed by guessing a URL. Only the HR user who owns the listing or
the candidate who submitted it may download. Responses are `attachment`, `nosniff`,
`private, no-store` and sandboxed by CSP.

**Duplicate applications are prevented by a unique compound index on `{job, candidate}`**, not
only by an application-level check. Two concurrent submissions cannot both succeed; the resulting
`E11000` is caught and returned as a 409.

**Search input cannot become a regex.** Keyword terms are escaped before being compiled into a
`RegExp`, so `?q=.*` matches nothing rather than everything — closing both a correctness bug and a
ReDoS vector. All query values are zod-parsed strings, so no object can be smuggled into a Mongo
filter.

**Error responses do not leak internals.** Unhandled exceptions are logged server-side and
returned as a generic 500; stack traces and driver messages never reach the client.

**Job descriptions and cover notes render as text, never as HTML**, so a listing cannot inject
markup into another user's page.

---

## Testing

```bash
npm install       # once
npm test          # 136 tests across 10 suites
npm run test:coverage
npx jest tests/applications.test.ts     # a single suite
npx jest -t 'applying twice'            # a single test by name
```

Tests import each App Router handler directly and invoke it with a real `NextRequest`, against an
ephemeral in-memory MongoDB and a temporary uploads directory. Cookies are genuinely signed JWTs
and files are genuinely written to disk, so authentication, validation and authorization are
exercised for real rather than mocked. No server and no Docker are needed, and each suite is
hermetic.

| Suite | Covers |
| --- | --- |
| `auth.test.ts` | signup, login, session, logout, rate limiting |
| `jobs.test.ts` | HR CRUD and the ownership matrix |
| `job-browse.test.ts` | search, filters, pagination, regex escaping |
| `applications.test.ts` | applying, upload validation, applicant pipeline, delete cascade |
| `resume-download.test.ts` | download authorization, headers, filename sanitisation |
| `users.test.ts` | profile editing, privilege-escalation attempts |
| `middleware.test.ts` | redirect behaviour, and that it is not an access control |
| `api-envelope.test.ts` | error-to-status mapping, no internal leakage |
| `query-helpers.test.ts` | URL/pagination helpers |
| `client-bundle-boundary.test.ts` | that no client component can reach Mongoose, bcrypt or the JWT key |

The edge cases called out in the brief are covered explicitly: duplicate signup email → 409,
wrong password → 401, applying twice to the same job → 409, one HR user touching another's
listing → 403, and a candidate hitting an HR-only route → 403.

Other quality gates:

```bash
npm run typecheck   # tsc --noEmit, strict mode
npm run lint        # eslint, zero warnings tolerated
npm run build       # production build
```

---

## Local development without Docker

Needs Node 18.18+ and a MongoDB reachable from the host.

```bash
npm install
cp .env.example .env
# point MONGODB_URI at your local mongod, e.g.
#   MONGODB_URI=mongodb://localhost:27017/job_portal
# and set UPLOADS_DIR=./uploads
npm run seed        # optional; SEED_ON_BOOT also works under `npm run dev`
npm run dev
```

The test suite needs neither of these — it starts its own in-memory MongoDB.

---

## Configuration

All variables are read through `src/lib/env.ts`, which validates them with zod and fails with a
readable message listing every problem at once.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | — (required) | Mongo connection string |
| `JWT_SECRET` | — (required, min 32 chars) | HS256 signing key for sessions |
| `JWT_EXPIRES_IN_SECONDS` | `604800` (7 days) | Session lifetime |
| `UPLOADS_DIR` | `/app/uploads` | Where resumes are written |
| `MAX_RESUME_BYTES` | `5242880` (5 MB) | Upload size cap |
| `SEED_ON_BOOT` | `false` (`true` in `.env.example`) | Seed demo data at server start |
| `SEED_HR_PASSWORD` | `Hr@Passw0rd123` | Password for both seeded HR accounts |
| `SEED_CANDIDATE_PASSWORD` | `Cand@Passw0rd123` | Password for the seeded candidate |
| `MONGO_INITDB_ROOT_USERNAME` / `_PASSWORD` / `MONGO_DB_NAME` | see `.env.example` | Used by the `mongo` container only |

### Docker layout

- **`mongo`** — `mongo:7`, health-checked with `mongosh`, data on the named volume `mongo_data`.
  Not published to the host; uncomment the `ports` block in `docker-compose.yml` to inspect it
  with a local client.
- **`app`** — multi-stage build producing Next's standalone output, run as a non-root user, with
  resumes on the named volume `resume_uploads` and a `wget` healthcheck against `/api/health`.
  It waits for `mongo` to report healthy before starting.

Both volumes survive `docker compose down` and are removed by `docker compose down -v`.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19 — UI and API in one deployable |
| Language | TypeScript 5.7, `strict` plus `noUncheckedIndexedAccess` |
| Database | MongoDB 7 via Mongoose 8 |
| Validation | zod 3 — the same schemas run on the client and the server |
| Auth | jose 5 (HS256 JWT) in httpOnly cookies, bcryptjs 2 for password hashing |
| Styling | Tailwind CSS 3 |
| Testing | Jest 29 with in-process route handlers and mongodb-memory-server 10 |
| Tooling | ESLint, Docker Compose v2 |

zod schemas are the single source of truth: the client imports the same module the API validates
with, so the two cannot drift. Because those schemas are shared, each domain keeps its enums and
wire types in a dependency-free `*.constants.ts` file that the model, the schema and the client
component all import — otherwise importing a schema would drag Mongoose into the browser bundle.
`tests/client-bundle-boundary.test.ts` walks the real import graph and fails if that ever
regresses.

---

## Known limitations

Things deliberately left out or simplified, and what they would take to fix.

- **Rate limiting is per process, in memory.** It blunts online password guessing against a single
  instance, but it neither survives a restart nor coordinates across replicas. Redis or an
  edge/WAF rule would be the real answer.
- **No CSRF token.** Mutations are protected by `SameSite=lax` cookies, which stops cross-site
  form posts in current browsers, but a double-submit token or an Origin check would be stronger
  defence in depth.
- **No refresh tokens or server-side session revocation.** A JWT stays valid until it expires;
  logging out only clears the cookie. Deleting or demoting an account does take effect
  immediately, because the role is re-read from the database on every request.
- **PDF validation stops at the magic bytes.** The file is not parsed, so a malformed or malicious
  PDF is stored as-is. It is never executed or rendered by the app, and downloads are sandboxed by
  CSP, but a production system would put uploads through antivirus and a PDF sanitiser.
- **Resumes live on a local volume**, which does not survive moving to multiple hosts. Object
  storage (S3 or equivalent) with signed, short-lived URLs is the production shape.
- **Search uses escaped regular expressions**, which cannot use an index and will not scale to a
  large collection. A MongoDB text index or a dedicated search service would replace it.
- **Applicant name search runs two queries** rather than one aggregation with `$lookup`. It is
  scoped to the applicants for that listing, so it is bounded, but it is not the most efficient
  shape.
- **Pagination uses skip/limit**, which degrades on deep pages. Cursor pagination would be the fix.
- **No email delivery.** Nothing notifies a candidate when their status changes; they see it on
  `/applications`.
- **`Secure` cookies over `http://localhost`** work because browsers treat localhost as a
  trustworthy origin. Deploying to any other host over plain HTTP would break sign-in — put the
  app behind TLS.
- **No automated browser tests.** Coverage is at the API and unit level; the UI was verified
  manually against the running container.
- **Seeded credentials are documented in this file and default in `.env.example`.** That is
  deliberate for review purposes and must not be carried into a real deployment.
