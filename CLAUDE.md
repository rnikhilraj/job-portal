# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # local dev server (needs a reachable MongoDB)
npm run build            # production build (Turbopack)
npm run typecheck        # tsc --noEmit
npm run lint             # eslint, zero warnings tolerated
npm test                 # all suites, both Jest projects
npm run test:coverage    # adds coverage + enforces thresholds
npm run seed             # idempotent demo data, for local dev only
```

Run **all four** of typecheck, lint, test and build before committing. They catch
different things: SWC does not typecheck, so a suite can pass green while `tsc`
fails.

### Running a single test

Jest runs **two projects** — `api` (Node environment, real in-memory MongoDB) and
`components` (jsdom). Filtering by path works across both; `--selectProjects`
narrows to one:

```bash
npx jest tests/jobs.test.ts --runInBand
npx jest --selectProjects components --runInBand
npx jest -t 'rejects a second application' --runInBand   # by test name
```

`--runInBand` matters: each API suite boots its own MongoMemoryServer, and
parallel workers trip over each other.

### Docker

```bash
cp .env.example .env
docker compose up --build      # UI on http://localhost:3000
docker compose down            # stop, keep data
docker compose down -v         # also wipe the database and uploaded resumes
```

**On this machine** `docker` is the Homebrew shim and `docker-credential-desktop`
is not on `PATH`, so compose fails with a credentials error. Prefix it:

```bash
export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin"
```

Node 22 is the floor everywhere — local, CI and the image. Local Node is pinned
by a `PATH` line in `~/.zshrc`.

## Architecture

### Organised by domain, not by file type

`src/modules/<domain>/` owns that domain's model, zod schemas and business logic.
`src/app/api/` holds only thin HTTP adapters: parse, authorize, delegate, respond.
Business logic in a route handler is a smell — move it into the service.

### The two rules that are easy to break

**1. `*.constants.ts` exists to keep Mongoose out of the browser.** Client
components share zod schemas with the server, and those schemas need each
domain's enums. If an enum is imported from `job.model.ts`, Mongoose comes with
it — that regression once shipped a 576 kB driver chunk to every job page. So
each domain keeps enums and wire types in a dependency-free `*.constants.ts`
that the model, the schema and the client component all import.

`tests/client-bundle-boundary.test.ts` walks the real import graph from every
client entry point and fails on `mongoose`, `bcryptjs`, `jose` or a `node:`
builtin. **Add new client components to its entry list.**

**2. `isSearchable` is the single source of truth for recruiter visibility.**
Every recruiter-facing read starts from `optedInCandidateFilter()`, and
`toDiscoverableCandidate()` *throws* rather than redacting if handed a candidate
who has not opted in. Nothing else may expose a candidate's contact details or
resume. See the security section of README.md for what opting in grants.

### Request flow

Page reads go through **server components calling the service layer directly** —
same modules the API routes use, behind the same `requirePageUser` guard. Writes
go through the API routes. Nothing makes an HTTP request to its own API.

### Error handling

`withRoute()` (`src/lib/api/route.ts`) wraps every handler: it connects to Mongo,
catches once, and is the only place a thrown error becomes a status code.
`ZodError → 400` with per-field details, the `AppError` subclasses → their own
status, Mongo `E11000 → 409`, anything else → a logged, generic 500. Throw an
`AppError`; never build an error response by hand.

Success is always `{ data, meta? }`, failure always `{ error: { code, message, details? } }`.

### Authorization

- `requireUser` / `requireRole` — API routes. Throw 401/403. Both re-read the
  role from Mongo rather than trusting the JWT.
- `requirePageUser` — server components. Redirects instead of throwing.
- `src/middleware.ts` — cookie *presence* only, and **not** a security boundary.
  It runs on Edge, where verifying the JWT would mean shipping the signing secret
  into that bundle. A forged cookie passes it and hits a 401 downstream.

## Gotchas that have cost real time

**A route-level `loading.tsx` swallows status codes.** It applies to a segment
*and all descendants*, and its Suspense boundary sits above the page — so Next
flushes a 200 shell before the page's auth guard runs, turning a 307 redirect or
404 into a client-side instruction with the wrong HTTP status. Use a `<Suspense>`
scoped to the result list *inside* the page instead. The `/hr` route group also
resolves its role gate in the layout, above every boundary, for the same reason.

**Next rewrites `tsconfig.json` on every build.** Reformatting it by hand just
produces a dirty tree after the next build. Leave it in Next's shape.

**`coverageThreshold` glob keys behave differently from directory keys.** A glob
applies the numbers per-file *and* removes those files from the global pool. Use
directory keys (`'./src/modules/'`) to threshold a group.

**jsdom has no global `Response`.** Constructing one in a component test throws a
`ReferenceError` that `apiFetch` reports as a transport failure — which silently
turns tests green against the wrong branch. Stub `fetch` with a plain object
exposing `status`, `ok` and `json()`.

**`userEvent.upload` honours the input's `accept` attribute.** A non-PDF is
refused before the component's own check runs. Pass `{ applyAccept: false }` to
exercise the fallback.

## Design system

Tokens live in `tailwind.config.ts`; motion vocabulary and component classes in
`src/app/globals.css`. Two conventions worth preserving:

- **`petrol` is the only interactive colour** and is never a status; the semantic
  ramp (slate/amber/green/rose) is never interactive chrome.
- **Colour never carries meaning alone.** Shortlisted green and Rejected rose are
  nearly identical under deuteranopia, so every status also has a glyph, a text
  label and a position on the pipeline rail.
- **`.panel-feature` is used exactly three times** — the landing hero, the apply
  form and the applicant funnel. One elevated moment per role. Spending it
  elsewhere turns a signature into wallpaper.

## Testing conventions

- API suites invoke App Router handlers directly with a real `NextRequest`, a
  genuinely signed cookie and an ephemeral MongoDB. No mocking of auth.
- Prove a new test is not vacuous: break the thing it guards and watch it fail.
  Two tests in this repo passed with the bug present before being rewritten.
- `tests/api-envelope.test.ts` asserts the 500 body **exactly**, on purpose, so
  that copy can only change deliberately.
