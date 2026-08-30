# Shortlist

A full-stack hiring platform with two roles. **Candidates** browse open roles, apply with
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
- [Design](#design)
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

It seeds five candidate accounts (all with the candidate password above), three of which have
opted in to recruiter search and two of which have not, so HR's candidate directory is visibly a
subset of everyone with an account:

| Candidate | Opted in to search? | Experience |
| --- | --- | --- |
| `candidate@example.com` — Sam Rivera | **No** | Mid |
| `asha@example.com` — Asha Nair | Yes | Senior |
| `marco@example.com` — Marco Ferreira | Yes | Mid |
| `lena@example.com` — Lena Fischer | Yes | Lead |
| `tomas@example.com` — Tomas Halonen | **No** | Entry |

Sam is opted out deliberately: log in as `candidate@example.com`, tick *Make my profile visible
to recruiters* on `/profile`, and watch the profile appear in HR's candidate search — then untick
it and watch it disappear.

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
│   ├── (hr)/hr/           jobs, jobs/new, jobs/[id]/edit, jobs/[id]/applicants,
│   │                      candidates
│   └── api/               route handlers only — no business logic
│
├── modules/
│   │                      Each domain owns a dependency-free *.constants.ts
│   │                      holding its enums and wire types, so client
│   │                      components can import them without pulling Mongoose
│   │                      into the browser bundle.
│   ├── auth/              auth.schema · auth.service · password · jwt · session · cookie
│   ├── users/             user.model · user.schema · user.service · user.constants
│   ├── jobs/              job.model · job.schema · job.service · job.constants
│   │                      · job.samples (the demo listings, read by both the
│   │                      seeder and the landing page so they cannot drift)
│   └── applications/      application.model · application.schema · application.service
│                          · application.constants
│
├── lib/
│   ├── api/               errors (typed AppError hierarchy) · respond (JSON envelope)
│   │                      · route (withRoute wrapper)
│   ├── db.ts              memoised Mongoose connection
│   ├── env.ts             lazily parsed, zod-validated environment
│   ├── validation.ts      shared pagination, ObjectId and regex-escaping helpers
│   ├── rate-limit.ts      fixed-window limiter for credential endpoints
│   ├── resume-storage.ts  PDF validation and on-disk storage — in lib/ because
│   │                      both applications and user profiles embed a resume
│   ├── query.ts           search-param normalisation for the list pages
│   ├── http.ts            client-side fetch wrapper over the JSON envelope
│   ├── local-day.ts       calendar-day helpers — deliberately not in a client
│   │                      module, because the server calls them too
│   └── seed.ts            idempotent demo data
│
├── components/            shared UI, including the pipeline rail, hero and funnel
├── instrumentation.ts     boot hook, Edge-safe: defers to instrumentation.node
├── instrumentation.node.ts validate env, seed — Node runtime only
└── middleware.ts          cookie-presence redirects (UX only — see Security notes)
```

### Data model

| Collection | Fields | Indexes |
| --- | --- | --- |
| `users` | `email` (unique, lowercased), `passwordHash` (`select: false`), `role`, `name`, `phone?`, `headline?`, `skills[]`, `isSearchable` (default `false`, candidate-only), `experienceLevel?` (`ENTRY`/`MID`/`SENIOR`/`LEAD`, candidate-only), `resume?` (general profile resume, candidate-only) | unique `email`, `{role, isSearchable, createdAt}` |
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
7. **Upload a general resume** (optional) — on `/profile`, under *Your resume*. A single PDF that
   belongs to your profile rather than to any one application, and can be replaced or removed at
   any time. It is private to you until you opt in, and the page says so.
8. **Opt in to recruiter search** (optional) — also on `/profile`, under *Recruiter visibility*.
   Ticking **"Make my profile visible to recruiters"** lets any HR user find you at
   `/hr/candidates` by name, headline or skill.

   Be clear on what this shares. While it is on, recruiters can see your name, headline, skills
   and experience level, **and your email address, phone number and general resume**. While it is
   off, none of that is visible and you do not appear in search at all — not lower down, not
   partially, not at all.

   It is **off by default** and nothing turns it on for you. Untick it and save, and you are gone
   from search on the very next query; any resume link a recruiter saved starts returning 403
   immediately.

   Your application history is never shared this way in either state. The resumes you attach to
   specific applications stay with those applications, visible only to the HR user who owns the
   listing you applied to.

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
7. **Search candidates** at `/hr/candidates` — a directory of candidates who have opted in to
   being found. Search across name, headline and skills, filter by experience level, and page
   through results. Each result shows their contact details and a resume download, because
   opting in is what grants those. Click through to `/hr/candidates/<id>` for the same profile on
   its own page.

   Candidates who have not opted in never appear, however well they match, and their details are
   never shown. If a candidate opts out after you found them, the profile page 404s and the
   resume link returns 403 on the next click — a saved URL is not a standing permission. What you
   will not see here is anyone's application history; that stays scoped to your own listings.
8. **Change a status** with the inline control. If the server rejects the change, the control
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
| `PATCH` | `/users/me` | any | Edit own name, phone, headline, skills; candidates also `isSearchable` and `experienceLevel` (400 for HR) |
| `GET` | `/users/me/resume` | any | Download own general resume |
| `PUT` | `/users/me/resume` | **candidate** | `multipart/form-data`: `resume` (PDF). Upload or replace |
| `DELETE` | `/users/me/resume` | **candidate** | Remove own general resume |
| `GET` | `/candidates` | **HR** | Opt-in candidate search. `?q=&experienceLevel=&page=&limit=` |
| `GET` | `/candidates/:id` | **HR** | One opted-in candidate. 404 if they are not opted in |
| `GET` | `/candidates/:id/resume` | **HR** | Their general resume. **403 unless `isSearchable` is true at request time** |
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
is `OPEN | CLOSED`, application `status` is `APPLIED | REVIEWED | SHORTLISTED | REJECTED`, and
`experienceLevel` is `ENTRY | MID | SENIOR | LEAD`.

`GET /api/candidates` and `GET /api/candidates/:id` return
`{ id, name, headline, skills, experienceLevel, email, phone, resume }`, where `resume` is
`{ originalName, sizeBytes }` or `null`. The path on disk is never included. There is no query
parameter that can widen the result set beyond opted-in candidates.

Note the two distinct resume endpoints: `/api/applications/:id/resume` serves the file attached to
one application and is governed by listing ownership, while `/api/candidates/:id/resume` serves a
candidate's general profile resume and is governed by the `isSearchable` opt-in.

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

**Writes must come from this origin.** `withRoute()` runs `assertSameOrigin()` before it touches
the database, so any POST, PATCH, PUT or DELETE carrying an `Origin` that is not this host is
refused with a 403. This sits underneath the cookie's `SameSite=lax`, which is the primary CSRF
control; the second layer exists for a browser that predates SameSite, a bug in its enforcement,
or a future change here that loosens the cookie and forgets what it was buying. A *missing*
`Origin` is allowed on purpose — browsers attach one to every cross-origin write and page
JavaScript cannot override it, so a request without one came from curl or a server, neither of
which carries the victim's cookies.

**The post-sign-in redirect cannot leave this origin.** `src/middleware.ts` sends an anonymous
visitor to `/login?next=<where they were going>`, and that parameter is set by whoever wrote the
link. It is validated by `safeRedirectPath()` before the browser is sent anywhere, so a crafted
`/login?next=https://evil.example` lands the user on their own role's home instead. The check
resolves the value against a fixed base and requires the origin to survive, rather than comparing
strings: `//evil.example` is scheme-relative and `/\evil.example` is normalised to the same thing
by the URL parser, and both start with `/`. `javascript:` and `data:` are refused by the same
rule. This matters more than an ordinary open redirect because the bounce happens *after* a
genuine sign-in, when the user has just been shown the real site and has no reason to look again.

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
permission check cannot be bypassed by guessing a URL. There are two of them, with different
rules: `/api/applications/:id/resume` is governed by listing ownership (the HR user who owns the
listing, or the candidate who applied), and `/api/candidates/:id/resume` is governed by the
`isSearchable` opt-in. Profile resume uploads run through the identical `storeResume()` path as
application uploads — magic-byte check, size cap, server-generated filename — because it is the
same module. Responses are `attachment`, `nosniff`,
`private, no-store` and sandboxed by CSP.

### The candidate search opt-in

`isSearchable` is the single source of truth for everything a recruiter can see about a candidate
who has not applied to their listing. Nothing else grants that access, and there is no second
flag, no role exemption and no admin bypass.

**Exactly what opting in exposes.** While `isSearchable` is true, any HR user can see the
candidate's name, headline, skills, experience level, **email address, phone number, and can
download their general profile resume**. While it is false, none of that is visible and the
candidate does not appear in search at all. The profile page states this in those terms, on both
sides of the toggle, before the choice is made.

What opting in does *not* expose, in either state: application history, which jobs someone applied
to, and the per-application resumes attached to those applications. Those remain scoped to
candidates who actually applied to that HR user's own listings, governed by listing ownership and
not by this flag.

**Enforced in the query, not the view.** Every recruiter-facing read starts from
`optedInCandidateFilter()`, which returns `{ role: 'CANDIDATE', isSearchable: true }` and is spread
first so a later key cannot override it. The query schema has no parameter that can widen it. A
candidate who has not opted in is never loaded from the database, so there is no "fetched then
filtered" step to get wrong.

**The serializer fails closed.** `toDiscoverableCandidate()` is the only constructor for the shape
containing contact details, and it *throws* rather than returning a redacted object if handed a
user who is not an opted-in candidate. A future caller who forgets the filter gets a 500 and a
server-side log instead of quietly leaking an email address. Two tests exercise the throw directly.

**Links are not capabilities.** The resume download is an authorized handler, never a public file
path, and it re-reads `isSearchable` on every request. A URL saved or bookmarked while a candidate
was discoverable returns 403 the moment they opt out — tested explicitly, including that the check
runs *before* the file lookup so the response cannot disclose whether a resume exists. Revoking
consent is immediate and complete; there is no cache and no grace period.

**Defaults and legacy rows.** `isSearchable` is `default: false` on the model, so documents written
before the field existed read back as opted out rather than undefined. A test unsets the field
directly to prove it.

The candidate's own resume is readable by the candidate through a separate endpoint
(`/api/users/me/resume`) keyed to their session. That is deliberately not gated on `isSearchable`:
the flag governs what *recruiters* may see, not whether someone can read back a file they uploaded
themselves.


**The two upload endpoints are rate limited per account**, not per IP. Applying to a job and
replacing a profile resume both write a PDF to the volume, and by the time either runs the session
has already been verified — so the bucket is keyed on the user id (`userKey()`), which cannot be
shed by rotating addresses and does not make one uploader throttle everyone behind a shared NAT.
The credential endpoints still key on IP (`clientKey()`), because they run before there is anyone
to attribute the request to.

**Duplicate applications are prevented by a unique compound index on `{job, candidate}`**, not
only by an application-level check. Two concurrent submissions cannot both succeed; the resulting
`E11000` is caught and returned as a 409.

**Search input cannot become a regex.** Keyword terms are escaped before being compiled into a
`RegExp`, so `?q=.*` matches nothing rather than everything — closing both a correctness bug and a
ReDoS vector. All query values are zod-parsed strings, so no object can be smuggled into a Mongo
filter.

**Security headers are set app-wide** in `next.config.ts`: a Content Security
Policy that pins connections and form actions to this origin, blocks `<base>`
rewriting, and forbids framing and plugins outright, plus `Permissions-Policy`
denying camera, microphone, geolocation, payment and USB,
`Cross-Origin-Resource-Policy`, `Cross-Origin-Opener-Policy`, and HSTS in
production only. Resume downloads get a far stricter `default-src 'none';
sandbox` through a later, more specific rule — a `next.config` header overrides
one set inside a route handler, so the app-wide policy would otherwise have
quietly replaced it.

> **The CSP is not an XSS control, and it would be misleading to present it as
> one.** `script-src` includes `'unsafe-inline'`, because Next's App Router
> emits inline bootstrap and streaming-payload scripts. That allowance is
> exactly what a `script-src` normally exists to remove, so the policy is
> defence in depth, not the control. The control is that every user-supplied
> string — job descriptions, cover notes, names, headlines — renders as text and
> never as HTML. Closing the gap properly means per-request nonces issued from
> middleware; see [Known limitations](#known-limitations).

**The containers run with capabilities dropped.** The app has `cap_drop: ALL`, a
read-only root filesystem with a tmpfs for `/tmp`, `no-new-privileges` and a
512 MB limit; only the uploads volume is writable. Mongo drops all capabilities
too and re-adds exactly the five its entrypoint needs to fix ownership and drop
to the mongodb user.

**Error responses do not leak internals.** Unhandled exceptions are logged server-side and
returned as a generic 500; stack traces and driver messages never reach the client.

**Job descriptions and cover notes render as text, never as HTML**, so a listing cannot inject
markup into another user's page.

---

## Testing

```bash
npm install       # once
npm test          # 509 tests across 30 suites (unit + api + component projects)
npm run test:coverage
npx jest tests/applications.test.ts     # a single suite
npx jest -t 'applying twice'            # a single test by name

npm run test:e2e     # 17 Playwright tests in a real browser (needs the stack up)
npm run test:e2e:report                 # open the last HTML report
```

The Playwright suite runs against a **running stack** rather than starting its own server, so
`docker compose up -d` first. It is deliberately small and asserts only what cannot be checked
below the browser — a client-side navigation actually happening, a redirect landing on the origin
it claims, a role gate resolving before the page paints.

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
| `candidate-search.test.ts` | the opt-in boundary, profile resume upload, recruiter resume access, HR-only access, search/filter/pagination |
| `page-guards.test.ts` | requirePageUser: redirect target and status for every signed-out and wrong-role case |
| `unit/middleware.test.ts` | redirect behaviour, and that it is not an access control |
| `unit/api-envelope.test.ts` | error-to-status mapping, no internal leakage |
| `unit/query-helpers.test.ts` | URL/pagination helpers |
| `unit/csrf.test.ts` | the same-origin gate on writes: hostile, look-alike, absent and sandboxed Origins |
| `unit/import-cycles.test.ts` | that `src/` has no import cycle, and that the applications domain stays off `job.service` |
| `unit/safe-redirect.test.ts` | that a `?next=` destination cannot leave this origin — scheme-relative, backslash and `javascript:` forms included |
| `unit/client-bundle-boundary.test.ts` | that no client component can reach Mongoose, bcrypt or the JWT key |
| `health.test.ts` | the probe's envelope, its connection-state reporting, and that it needs no session |
| `delete-cascade-order.test.ts` | that rows are deleted before the files they point at, so a failed unlink cannot orphan a live record |
| `components/pipeline-rail.test.tsx` | the status rail: accessible description, the seen-status memory, reduced motion, frame cleanup |
| `components/applicant-status-select.test.tsx` | optimistic update and rollback, and that a 403 surfaces the server's reason |
| `components/mobile-nav.test.tsx` | disclosure behaviour: Escape, outside click, and closing on navigation |
| `components/apply-form.test.tsx` | client-side upload checks, and that a rejected file never reaches the network |
| `components/pipeline.test.tsx` | the signature element: chip labels, funnel maths, and the hero rail — static on load, scrubbable by press |
| `components/presentational.test.tsx` | field errors, empty states, pagination, page header, job card, skeletons |
| `components/login-form.test.tsx` | role-based landing, that a legitimate `next` survives, and that a hostile one is never followed |
| `components/job-form.test.tsx` | posting vs editing, defaults, client-side validation, and how a server refusal surfaces |
| `components/profile-form.test.tsx` | that only profile fields are sent, skill normalisation, and the opt-in naming what it exposes |
| `components/profile-resume.test.tsx` | upload, replace and remove, local PDF/size checks, and refusal vs unreachable server |
| `components/navigation-and-filters.test.tsx` | role-aware navigation, logout failure handling, and the delete-cascade confirmation |
| `components/landing.test.tsx` | the landing sections: postings framed as fixtures, the four real stages, keyboard-reachable strip |
| `unit/copy-terminology.test.ts` | the one-noun rule from CLAUDE.md, and that error defaults are not REST jargon |

The edge cases called out in the brief are covered explicitly: duplicate signup email → 409,
wrong password → 401, applying twice to the same job → 409, one HR user touching another's
listing → 403, and a candidate hitting an HR-only route → 403.

Coverage is reported over `src/app/api`, `src/modules`, `src/lib` **and**
`src/components`, with per-directory thresholds acting as ratchets rather than
as a single global figure that would hide which layer regressed. What the
numbers do **not** cover is worth naming: `src/lib/seed.ts` reads 0% by design —
it runs only at boot, and the docker job in CI asserts `[seed] complete`
instead — and nothing here drives a real browser, so every claim about how the
app *looks* rests on reading served HTML and compiled CSS. See
[Known limitations](#known-limitations).

Every gate runs on push and pull request via `.github/workflows/ci.yml`, which
has two jobs. `verify` runs a dependency audit, typecheck, lint, the Jest suite
with coverage, and the production build. `docker` boots the Compose stack from
scratch to prove the README's single-command claim, runs the Playwright suite
against it, and scans the built image with Trivy for HIGH and CRITICAL CVEs.
`.github/dependabot.yml` keeps npm, the Actions and the base image current so
those two scanners have less to find.

Config lives in `eslint.config.mjs` (ESLint 9 flat config), `jest.config.mjs`
(three projects — `unit` for suites needing no database, `api` for Node plus an
ephemeral MongoDB, `components` for jsdom) and the three setup files
`jest.setup.unit.ts`, `jest.setup.ts` and `jest.setup.components.ts`.

The `unit` project exists so that a suite which only reads files off disk does
not boot a MongoMemoryServer it never queries. Six did, and on a loaded machine
that boot can exceed mongodb-memory-server's own 10s limit — which is how a
static import-graph walk once failed for a reason having nothing to do with
imports. Suites that need a database live in `tests/`; those that do not live in
`tests/unit/` and run in well under a second.

Other quality gates:

```bash
npm run typecheck   # tsc --noEmit, strict mode
npm run lint        # eslint, zero warnings tolerated
npm run build       # production build
```

---

## Local development without Docker

Needs Node 22+ and a MongoDB reachable from the host. Node 22 LTS is what the
container, CI and this project were developed against; Node 18 and 20 have both
reached end of life. `.nvmrc` pins it, and `engine-strict` in `.npmrc` makes
`npm install` refuse an older runtime rather than let the test suite fail
later with a confusing `File is not defined`.

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

**The runtime stage carries no package manager.** `apk upgrade` patches the base image's OS
packages, then npm, npx, yarn and corepack are deleted: the standalone server runs as
`node server.js` and never shells out to one, so they are attack surface with no purpose. That is
not housekeeping — every HIGH and CRITICAL the image scan reported came from npm's own bundled
dependencies (`tar`, `sigstore`, `pacote`, `brace-expansion`) rather than from anything this app
installs, and the OS half was `libssl3`/`libcrypto3` lagging the pinned tag. With both addressed
the image scans clean at HIGH and CRITICAL, which is what lets CI gate on it with `exit-code: 1`
instead of printing a report nobody reads.

Both volumes survive `docker compose down` and are removed by `docker compose down -v`.

---

## Design

### Palette

Six defined colours. Every foreground pairing below clears WCAG AA; the lowest measured ratio
anywhere in the interface is 4.5:1.

| Role | Hex | Contrast |
| --- | --- | --- |
| Petrol (primary) | `#0F6675` / `#0B4E5A` | 6.61:1 / 9.33:1 on white |
| Ink (text) | `#16262B` → `#5F7176` | 15.6:1 → 4.79:1 |
| Mist (canvas, hairlines) | `#F5F8F9` / `#DDE4E7` | — |
| Amber (Reviewed) | `#96520A` | 5.31:1 on tint |
| Green (Shortlisted, Open) | `#116B45` | 5.60:1 on tint |
| Rose (Rejected) | `#B02A45` | 5.43:1 on tint |

Two rules hold it together, both enforced by convention in `tailwind.config.ts`:

1. **Petrol is the only interactive colour** — buttons, links, focus rings — and is never used
   for a status. The semantic ramp is never used for interactive chrome. A coloured element is
   therefore never ambiguous about what it is telling you.
2. **Colour never carries meaning alone.** A CVD simulation of the four application statuses
   showed Shortlisted green and Rejected rose collapsing to a colour distance of 32 under
   deuteranopia, with near-identical luminance (0.111 vs 0.113) — the classic red/green failure.
   Conventional hues were kept, and the load was moved off colour entirely (see below).

### Typefaces

**Archivo** for display and **IBM Plex Sans** for body, both self-hosted at build time by
`next/font` — no request to a font CDN at runtime and no flash of unstyled text. Archivo is a
sturdy grotesque with presence at large sizes, used with restraint for headings and figures.
Plex was drawn for dense business and technical content, which is what most of this app is:
job descriptions, applicant lists, forms.

### Signature element — the pipeline rail

Recruiting's native mental model is a funnel, so status is drawn as a position on a track rather
than as a coloured chip alone.

```
Applied          ●━━━━━━━○───────○
Reviewed         ●━━━━━━━●───────○
Shortlisted      ●━━━━━━━●━━━━━━━●
Rejected         ✕╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌    (off-path, not a fourth stage)
```

It appears in exactly two places: per application on the candidate's tracker and each HR
applicant row, and aggregated as a funnel bar at the top of a listing's applicants page.

This is the accessibility mechanism as much as the visual one. State is encoded in four
independent channels — fill position, glyph, text label, and colour — and the first three all
survive in greyscale. `PipelineRail` also renders an `sr-only` sentence ("Reviewed — stage 2 of
3") so the whole thing has a text equivalent. Rejected terminates the rail rather than occupying
a fourth position, because that is what actually happened.

### Quality floor

- **Focus** — one `:focus-visible` rule at the base layer, so no interactive element can ship
  without a visible petrol ring.
- **Responsive** — usable from 320px up. Navigation collapses to a disclosure panel below `md`;
  there is not a single `<table>` or `overflow-x` in the app, so dense lists reflow into cards
  rather than scrolling sideways; touch targets are ≥44px via `min-h-11` on buttons and inputs.
- **Empty states** — designed, and distinct for "nothing here yet" versus "your filter matched
  nothing", which are different problems with different fixes.
- **Loading** — skeletons that mirror the shape of the content, marked `aria-hidden` with a
  single polite status message alongside. The Suspense boundary is placed inside each page,
  around the result list only, rather than as a route-level `loading.tsx`. That matters for
  more than layout: a route-level boundary sits *above* the page component, so Next flushes a
  200 shell before the page's auth guard runs, which downgrades a 307 redirect or a 404 to a
  client-side instruction with the wrong HTTP status. Scoping the boundary keeps authorization
  resolving before the first byte, and only the query streams.
- **Errors** — specific about what happened and what is still true ("Status not saved — still
  showing as before"), never a generic apology.
- **Reduced motion** — honoured via `prefers-reduced-motion`.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19 — UI and API in one deployable |
| Language | TypeScript 5.7, `strict` plus `noUncheckedIndexedAccess` |
| Database | MongoDB 7 via Mongoose 8 |
| Validation | zod 3 — the same schemas run on the client and the server |
| Auth | jose 5 (HS256 JWT) in httpOnly cookies, bcryptjs 2 for password hashing |
| Styling | Tailwind CSS 3, Archivo + IBM Plex Sans via next/font (self-hosted) |
| Testing | Jest 30 with in-process route handlers and mongodb-memory-server 10; Playwright 1.62 for the browser suite |
| Tooling | ESLint 9 (flat config), Prettier 3, Docker Compose v2, GitHub Actions CI, Trivy, Dependabot |

zod schemas are the single source of truth: the client imports the same module the API validates
with, so the two cannot drift. Because those schemas are shared, each domain keeps its enums and
wire types in a dependency-free `*.constants.ts` file that the model, the schema and the client
component all import — otherwise importing a schema would drag Mongoose into the browser bundle.
`tests/unit/client-bundle-boundary.test.ts` walks the real import graph and fails if that ever
regresses, and `tests/unit/import-cycles.test.ts` walks the same graph for cycles.

---

## Known limitations

Things deliberately left out or simplified, and what they would take to fix.

- **Rate limiting is per process, in memory.** Login, signup and the two resume upload endpoints
  are all metered, but the counters neither survive a restart nor coordinate across replicas, so
  a second instance doubles every allowance. Redis or an edge/WAF rule would be the real answer.
  The IP-keyed buckets on the credential endpoints also trust `X-Forwarded-For`, which is
  attacker-controlled unless something trusted terminates in front of the app.
- **The CSP allows inline scripts.** `script-src` carries `'unsafe-inline'` to
  accommodate Next's inline bootstrap and streaming-payload scripts, which means
  the policy does not stop injected inline script and is not the app's XSS
  control. Escaping at render time is. The fix is a per-request nonce generated
  in middleware, set on the CSP header and passed to Next — worth doing, and not
  done here because `src/middleware.ts` is deliberately kept to cookie presence
  and nothing else.
- **CSRF defence is `SameSite=lax` plus an Origin check, not a synchroniser token.** Both layers
  are in place — the cookie attribute, and `assertSameOrigin()` refusing any write whose `Origin`
  is not this host. A per-session token would add little on top of those two and would have to be
  threaded through every form; it is the right next step only if the cookie is ever loosened to
  `SameSite=none`.
- **No refresh tokens or server-side session revocation.** A JWT stays valid until it expires;
  logging out only clears the cookie. Deleting or demoting an account does take effect
  immediately, because the role is re-read from the database on every request.
- **No password reset flow.** A candidate or HR user who forgets their password currently has no
  self-service recovery path — this would require an email delivery service in a production
  deployment.
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
- **Opting in is all-or-nothing, and the flag's meaning has widened.** A candidate cannot share a
  headline without contact details, be visible to some recruiters and not others, or set an expiry
  on their visibility. More importantly: `isSearchable` originally exposed only name, headline,
  skills and experience level, and now also exposes email, phone and resume. Anyone who opted in
  under the narrower promise is covered by the wider one without having re-consented. A production
  change of this kind should reset the flag to `false` for existing accounts and ask again; this
  build does not, because it would wipe the demo data a reviewer is meant to see.
- **No audit trail and no anti-scraping controls.** Nothing records which recruiter viewed or
  downloaded whose profile, the candidate is never told they were found, and an HR account can
  page through the entire directory unthrottled. Contact details and resumes make that materially
  more valuable to abuse than the earlier metadata-only version did. Per-recruiter rate limits,
  a view log surfaced to the candidate, and watermarked downloads are the obvious next steps.
- **No way to message a candidate in-product.** Search results link to `mailto:` and show a phone
  number; there is no messaging, no templated outreach and no record of contact attempts.
- **Profile resumes are not scanned or parsed.** The upload is validated as a PDF by its magic
  bytes and capped in size, exactly like an application resume, but nothing extracts skills from
  it or checks it for malware. It also does not populate the skills field automatically.
- **Search results are not deduplicated against your own applicants**, so someone who has already
  applied to one of your listings appears in the directory as well.
- **`Secure` cookies over `http://localhost`** work because browsers treat localhost as a
  trustworthy origin. Deploying to any other host over plain HTTP would break sign-in — put the
  app behind TLS.
- **The browser tests assert behaviour, not appearance.** Playwright drives sign-in, the role
  gates, navigation and the redirect guard in a real Chromium, but nothing asserts on *rendering*:
  responsive behaviour at each breakpoint, motion and focus rings were verified by reading served
  HTML and compiled CSS, not by looking at them. Visual regression snapshots and a second engine
  are the remaining gap.
- **The e2e suite shares the login rate limit.** Every browser test arrives from one IP, and login
  allows ten attempts per fifteen minutes, so the specs reuse a saved session rather than signing
  in repeatedly. Adding several specs that each sign in for real will eventually trip a correct
  429 that looks like a failure. `docker compose restart app` clears the counters.
- **Seeded credentials are documented in this file and default in `.env.example`.** That is
  deliberate for review purposes and must not be carried into a real deployment.
