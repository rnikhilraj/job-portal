# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # local dev server (needs a reachable MongoDB)
npm run build            # production build (Turbopack)
npm run typecheck        # tsc --noEmit
npm run lint             # eslint, zero warnings tolerated
npm run format           # prettier --write, the repo's one formatting authority
npm run format:check     # fails on drift; what CI would run
npm test                 # all suites, all three Jest projects
npm run test:e2e         # Playwright, in a real browser — needs the stack running
npm run test:coverage    # adds coverage + enforces thresholds
npm run seed             # idempotent demo data, for local dev only
```

Run **all four** of typecheck, lint, test and build before committing. They catch
different things: SWC does not typecheck, so a suite can pass green while `tsc`
fails.

### Running a single test

Jest runs **three projects** — `unit` (Node, no database), `api` (Node, real
in-memory MongoDB) and `components` (jsdom). Filtering by path works across all
three; `--selectProjects` narrows to one:

```bash
npx jest tests/jobs.test.ts --runInBand
npx jest --selectProjects unit --runInBand        # ~0.6s, boots no mongod
npx jest --selectProjects components --runInBand
npx jest -t 'rejects a second application' --runInBand   # by test name
```

`--runInBand` matters: each API suite boots its own MongoMemoryServer, and
parallel workers trip over each other.

**A suite that needs no database goes in `tests/unit/`.** Everything in the
`api` project boots a MongoMemoryServer through `jest.setup.ts`, whether or not
the file ever queries it. Six suites were paying that cost for nothing, and the
bill came due as flakiness rather than slowness: under load the boot can exceed
mongodb-memory-server's own 10s limit, so a suite that does nothing but read
files off disk fails with `Instance failed to start`. If a new suite touches no
model, no factory and no handler, put it in `tests/unit/` — it will run in
milliseconds and cannot fail for a reason unrelated to its assertions.

### End-to-end tests

`npm run test:e2e` runs Playwright against a **running stack** — `docker compose
up -d` first; there is no `webServer` block, deliberately, because starting a
second copy of the app on top of the Compose one is how an e2e suite starts
failing for its own reasons. Only chromium is installed.

**Watch the login rate limit.** Every spec arrives from one IP and login allows
ten attempts per fifteen minutes. The suite signs in twice in a setup project
and reuses the saved session; specs that sign in for real are limited to the
ones testing sign-in. Add several more and you will hit a correct 429 that reads
as a test failure. `docker compose restart app` clears the in-memory counters.

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

Node 22 is the floor everywhere — local, CI, the image and `engines`. `.nvmrc`
pins it and `.npmrc` sets `engine-strict`, so `npm install` refuses an older
runtime by name instead of letting it fail later.

**Do not trust the shell's default `node`.** This machine has several Homebrew
versions and `node@18` has resolved ahead of the `~/.zshrc` line before now. On
18 the suite fails ~50 times with `ReferenceError: File is not defined`, because
the global `File` the upload tests need only exists from Node 20. Check `node -v`
before drawing any conclusion from a red run.

## Architecture

### Organised by domain, not by file type

`src/modules/<domain>/` owns that domain's model, zod schemas and business logic.
`src/app/api/` holds only thin HTTP adapters: parse, authorize, delegate, respond.
Business logic in a route handler is a smell — move it into the service.

### The three rules that are easy to break

**1. No import cycles, and `job.ownership.ts` is why.** `job.service` cascades a
delete into `application.service`, and `application.service` needs the listing's
owner. Those two facts used to make the modules mutually dependent — it worked
only because ESM hoists function declarations. The shared check now lives in
`src/modules/jobs/job.ownership.ts`; import it from there rather than reaching
across. `tests/unit/import-cycles.test.ts` walks the graph and fails on any
cycle, naming the loop.

**2. `*.constants.ts` exists to keep Mongoose out of the browser.** Client
components share zod schemas with the server, and those schemas need each
domain's enums. If an enum is imported from `job.model.ts`, Mongoose comes with
it — that regression once shipped a 576 kB driver chunk to every job page. So
each domain keeps enums and wire types in a dependency-free `*.constants.ts`
that the model, the schema and the client component all import.

`tests/client-bundle-boundary.test.ts` walks the real import graph from every
client entry point and fails on `mongoose`, `bcryptjs`, `jose` or a `node:`
builtin. **Add new client components to its entry list.** A component is only
covered if it is listed or reachable from something listed, so one whose sole
importer is a *server* component is guarded by nothing — that is how
`delete-job-button.tsx` sat outside the walk.

**3. `isSearchable` is the single source of truth for recruiter visibility.**
Every recruiter-facing read starts from `optedInCandidateFilter()`, and
`toDiscoverableCandidate()` *throws* rather than redacting if handed a candidate
who has not opted in. Nothing else may expose a candidate's contact details or
resume. See the security section of README.md for what opting in grants.

### Request flow

Page reads go through **server components calling the service layer directly** —
same modules the API routes use, behind the same `requirePageUser` guard. Writes
go through the API routes. Nothing makes an HTTP request to its own API.

### Error handling

`withRoute()` (`src/lib/api/route.ts`) wraps every handler: it runs the
same-origin check on writes, connects to Mongo, catches once, and is the only
place a thrown error becomes a status code. The CSRF check lives there rather
than per-route for the same reason the error mapping does — a control that must
be remembered on each route is one that will be forgotten on the route that
needed it. A *missing* `Origin` is allowed by design; see the comment in
`src/lib/api/csrf.ts` before tightening it.
`ZodError → 400` with per-field details, the `AppError` subclasses → their own
status, Mongo `E11000 → 409`, anything else → a logged, generic 500. Throw an
`AppError`; never build an error response by hand.

Success is always `{ data, meta? }`, failure always `{ error: { code, message, details? } }`.

On the client, every component calling `apiFetch` catches and distinguishes an
`ApiRequestError` — show the server's own message — from a transport failure —
say the request never landed and nothing changed. Swallowing the error, or
navigating as though the call succeeded, is the bug: `LogoutButton` did exactly
that and left people signed in while reporting nothing.

### Authorization

- `requireUser` / `requireRole` — API routes. Throw 401/403. Both re-read the
  role from Mongo rather than trusting the JWT.
- `requirePageUser` — server components. Redirects instead of throwing.
- `src/middleware.ts` — cookie *presence* only, and **not** a security boundary.
  It runs on Edge, where verifying the JWT would mean shipping the signing secret
  into that bundle. A forged cookie passes it and hits a 401 downstream.

Rate limiting picks its bucket from whatever is trustworthy at that point:
`clientKey()` keys on IP for endpoints that run *before* authentication (login,
signup), and `userKey()` keys on the verified user id for ones that run after
(both resume uploads). Prefer `userKey` whenever a session is already in hand —
`X-Forwarded-For` is attacker-controlled with nothing trusted in front. Counters
live in module state, so `jest.setup.ts` clears them between tests.

## Gotchas that have cost real time

**A route-level `loading.tsx` swallows status codes.** It applies to a segment
*and all descendants*, and its Suspense boundary sits above the page — so Next
flushes a 200 shell before the page's auth guard runs, turning a 307 redirect or
404 into a client-side instruction with the wrong HTTP status. Use a `<Suspense>`
scoped to the result list *inside* the page instead. The `/hr` route group also
resolves its role gate in the layout, above every boundary, for the same reason.

**A function exported from a `'use client'` module cannot be called on the
server.** It arrives there as a client *reference*, and invoking it throws
`Attempted to call x() from the server` — a 500 on every request. What makes it
expensive is that nothing catches it first: `tsc`, ESLint, `next build` and the
whole Jest suite all pass, because Jest does not enforce the RSC boundary and
the compiler does not either. Only requesting the page finds it. Helpers both
sides need go in a neutral module — `src/lib/local-day.ts` exists for exactly
this reason.

**Next rewrites `tsconfig.json` on every build.** Reformatting it by hand just
produces a dirty tree after the next build. Leave it in Next's shape.

**`coverageThreshold` glob keys behave differently from directory keys.** A glob
applies the numbers per-file *and* removes those files from the global pool. Use
directory keys to threshold a group — `'./src/modules/'`, `'./src/lib/api/'` and
`'./src/components/'` each have one, which leaves `global` covering only
`src/app/api/` plus the non-api files in `src/lib/`. That is why the `global`
numbers look unrelated to the summary row, and why `seed.ts` at 0% drags the
global branch floor so far below the others.

**jsdom has no global `Response`.** Constructing one in a component test throws a
`ReferenceError` that `apiFetch` reports as a transport failure — which silently
turns tests green against the wrong branch. Stub `fetch` with a plain object
exposing `status`, `ok` and `json()`.

**`userEvent.upload` honours the input's `accept` attribute.** A non-PDF is
refused before the component's own check runs. Pass `{ applyAccept: false }` to
exercise the fallback.

**`jest.mock()` does not resolve the `@/` alias.** `next/jest` maps it for
ordinary imports but not for the path handed to `jest.mock` or
`jest.requireActual`, which fail with "Cannot find module '@/…'". Use a relative
path (`jest.mock('../src/lib/resume-storage')`). It still intercepts the module
the code under test imported by alias, because both resolve to the same file.

**`undefined` does not survive `JSON.stringify`.** A zod schema that maps a
cleared form field to `undefined` loses the difference between "clear this" and
"not mentioned" the moment the client sends its parsed output over the wire: the
key is dropped and the server sees an absent field. Map cleared values to `null`
and branch on the value, never on `'key' in input`. This shipped as a real bug
on `experienceLevel` — the save reported success and the old value survived.

**A `next.config` header overrides one set inside a route handler**, and among
config rules the *later* match wins. The resume routes set their own
`default-src 'none'; sandbox`, which the app-wide policy silently replaced until
a more specific rule was added *below* the catch-all. Note also that the app-wide
`script-src` carries `'unsafe-inline'` and is therefore not the XSS control —
render-time escaping is. See the security section of README.md before describing
it as anything stronger.

**Changing `JWT_ISSUER` signs everybody out, and nothing used to notice.**
`verifySessionToken` checks the issuer, so a token minted under the old string
fails verification and every live session dies on deploy. What made it dangerous
is that the constant had exactly one occurrence in the repo and no test asserted
it: every suite signs through `signSessionToken` and inherits whatever the
constant says, so the whole suite stayed green straight through the rename.
`tests/auth.test.ts` now signs a token carrying the old issuer and asserts it
verifies to `null`. Move the string only on a deploy where a forced sign-out is
acceptable.

**A `vw`-based font size keeps growing after its container has stopped.** The
landing hero's text column is capped by `max-w-6xl`, so past ~1184px the box is
fixed while the viewport is not — a `clamp()` or `min()` in `vw` goes on scaling
and the headline wraps at exactly the widths it was meant to fit. Size against
the column instead: `container-type: inline-size` on the parent and `cqw` on the
text, which is what `.hero-column` / `.hero-headline` in `globals.css` do. The
`9.3cqw` ceiling there is measured from the subsetted Archivo file `next/font`
ships — the string advances 10.481em at display-lg's `-0.02em` tracking — not
guessed. A materially longer headline needs it re-measured, not nudged.

**There is a Prettier config, and it is load-bearing.** The repo went a long time
without one, and an editor running its own defaults quietly rewrote whole files
to double quotes and four-space indent on save — twice turning a one-line copy
change into a 250-line diff. `.prettierrc` pins the existing style (single
quotes, two-space, 100 columns) and `npm run format:check` fails on drift.
`.prettierignore` carries two deliberate exemptions with reasons: `tsconfig.json`,
which Next rewrites anyway, and `src/app/globals.css`, whose motion ladders are
aligned one-liners that Prettier expands into three-line blocks.

## Design system

Tokens live in `tailwind.config.ts`; motion vocabulary and component classes in
`src/app/globals.css`. Three conventions worth preserving:

- **`petrol` is the only interactive colour** and is never a status; the semantic
  ramp (slate/amber/green/rose) is never interactive chrome.
- **Colour never carries meaning alone.** Shortlisted green and Rejected rose are
  nearly identical under deuteranopia, so every status also has a glyph, a text
  label and a position on the pipeline rail.
- **`.panel-feature` is used exactly three times** — the landing hero, the apply
  form and the applicant funnel. One elevated moment per role. Spending it
  elsewhere turns a signature into wallpaper.

The `(auth)` layout deliberately does **not** cap width — it sets the page gutter
and nothing else, and each auth page owns its own measure. Login and signup both
run a two-column split at `lg` (form right, supporting copy left) and constrain
their own form column; a new auth page that forgets to set one will stretch the
full `max-w-5xl`.

## Copy

### One noun per concept

Five words for one object had crept in — *job*, *listing*, *role*, *position*,
*opening* — including a page whose eyebrow said "Open roles" directly above a
title saying "Open positions". The rule is about **the thing being named**, not
about who is reading:

- **role** — the work itself. Candidates browse, apply to, and get shortlisted
  for roles. HR describes a role when writing its title, location and
  description.
- **listing** — the published record advertising a role. It is posted, edited,
  closed, deleted and owned. "My listings", "Close a listing without deleting
  it", "You can only change listings you posted".
- **job** — **code only**: the Mongoose model, the collection, `/jobs` and
  `/api/jobs` routes, params, component and file names. Never appears in new
  user-facing copy.
- ***opening*, *position*, *vacancy*** — retired. Do not reintroduce them.

`tests/unit/copy-terminology.test.ts` enforces this: it walks every file under
`src/app` and `src/components` and fails on the retired forms. It checks only
the unambiguous plurals, because "without opening a spreadsheet" and "the
position moves along the rail" are honest English this product uses. **Prose in
README.md and this file is not covered** — that is where "browse openings"
survived a whole terminology pass.

The `job` half of the rule is enforced separately, and needed a different
technique: the word is required in code (the `Job` model, `jobType`, `/jobs`,
`JobCard`) and banned only in copy, so a raw source scan would flag hundreds of
legitimate identifiers. `extractCopy()` pulls out just JSX text nodes, the
values of copy-carrying props and route `metadata` titles, and checks those.
It went unenforced long enough for the code to break the rule in ten places,
including a page whose `metadata.title` said "My listings" directly above an
`<h1>` reading "My job listings". Interpolated template literals are a stated
blind spot — skipped rather than half-checked.

The existing `/jobs` URLs and the `Job` model keep their names; renaming routes
is a separate change from renaming copy.

### Error messages are product copy

`src/lib/api/errors.ts` holds the defaults, and every one is user-facing — they
are what a caller sees when a service throws without its own message. They must
read like the rest of the product, not like a REST library: "We could not find
that", never "Resource not found"; "That link does not point at anything", never
"Malformed identifier in request". Prefer overriding at the call site with a
message that names the actual thing.

The same applies to `src/lib/http.ts`, which is the last line of defence when a
response cannot be parsed at all.

`tests/api-envelope.test.ts` pins the 500 body **exactly**, so that one string
can only change deliberately.

## Testing conventions

- API suites invoke App Router handlers directly with a real `NextRequest`, a
  genuinely signed cookie and an ephemeral MongoDB. No mocking of auth.
- **Fixture passwords are hashed once, not once per user.** `tests/helpers/auth.ts`
  memoises the bcrypt hash per distinct password. Cost 12 is ~250ms, fixtures are
  created ~190 times a run, and that arithmetic was most of the suite's runtime —
  `candidate-search.test.ts` went from 27.7s to 1.8s. The cached value is a real
  hash of that password, so sign-in still exercises the real comparison; only the
  per-fixture salt is shared, which nothing asserts on. Do not "fix" this by
  lowering `SALT_ROUNDS` under `NODE_ENV=test` — that puts a branch in a
  security-critical file and stops the suite testing what the README describes.
- Prove a new test is not vacuous: break the thing it guards and watch it fail.
  Three tests in this repo have passed with the bug present before being
  rewritten. The latest drove a raw `{experienceLevel: ''}` body that the browser
  never sends, and so missed that the real client path dropped the field
  entirely — when a handler is exercised directly, check the fixture matches what
  the UI actually puts on the wire.
- `tests/api-envelope.test.ts` asserts the 500 body **exactly**, on purpose, so
  that copy can only change deliberately.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
