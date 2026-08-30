import fs from 'node:fs';
import path from 'node:path';

/**
 * The noun rule from CLAUDE.md, enforced.
 *
 * Five words for one object had drifted into the UI — job, listing, role,
 * position, opening — including a page whose eyebrow read "Open roles" directly
 * above a title reading "Open positions". A documented rule alone drifts back;
 * this fails the build instead.
 *
 * Only the unambiguous job-noun forms are checked. Singular "opening" and
 * "position" have ordinary English senses this product legitimately uses
 * ("without opening a spreadsheet", "the position moves along the rail"), and a
 * guard that flagged those would be turned off within a week.
 *
 * "job" needs a different technique, which is why it went unenforced while the
 * rule sat in CLAUDE.md and the code broke it in ten places — a page whose
 * metadata said "My listings" above an <h1> reading "My job listings", among
 * others. The word is *required* in code (the Job model, jobType, /jobs,
 * JobCard) and banned only in copy, so a raw source scan like the one above
 * would flag hundreds of legitimate identifiers. extractCopy() below pulls out
 * just the strings a user reads and checks those.
 */
const UI_DIRS = ['src/app', 'src/components'];

const RETIRED = [
  { pattern: /\bopenings\b/i, instead: 'roles' },
  { pattern: /\bpositions\b/i, instead: 'roles' },
  { pattern: /\bopen position\b/i, instead: 'open role' },
  { pattern: /\bvacanc(?:y|ies)\b/i, instead: 'role or listing' },
];

function sourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

/** Comments explain the code and are not shipped, so they are not copy. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The strings a user actually reads, pulled out of a `.tsx` source.
 *
 * Three shapes cover the app's copy:
 *   - JSX text nodes            `<h1>Edit listing</h1>`
 *   - copy-carrying props       `title="My listings"`, `label: 'Browse roles'`
 *   - route metadata            `export const metadata = { title: 'Profile' }`
 *
 * Everything else — identifiers, imports, hrefs, className, enum keys — is code
 * and is deliberately not scanned. That asymmetry is the whole point: "job" is
 * required in code and banned in copy, so the check has to know the difference.
 */
/*
 * What separates prose from code in the two patterns below.
 *
 * The `>` of a TypeScript generic closes a JSX-text match just as well as a tag
 * does, so `useState<JobType>(job?.jobType ?? 'FULL_TIME')` read as a text node;
 * and a `label:` holding a template literal captures through its own `${...}`.
 * Neither is copy. Prose carries no semicolons, straight quotes, `??`, `?.`,
 * `=>` or `${`.
 *
 * The cost is a stated blind spot: an interpolated template literal is skipped
 * rather than partially checked, so `label: \`Posted ${date}\`` is not scanned.
 * That is the deliberate trade — a guard with false positives gets deleted,
 * and the static half of the copy is where the drift actually happens.
 */
const CODE_SIGNS = /[;'"`]|\?\?|\?\.|=>|\$\{/;

function extractCopy(source: string): string[] {
  const copy: string[] = [];

  for (const match of source.matchAll(/>([^<>{}]+)</g)) {
    const text = (match[1] as string).trim();
    if (text && !CODE_SIGNS.test(text)) copy.push(text);
  }

  // Values of props and object keys that carry user-visible words. `description`
  // covers the route metadata description; `title` covers both the JSX prop and
  // the metadata field, which is why it is matched with either `=` or `:`.
  const COPY_KEYS = 'title|label|eyebrow|placeholder|hint|description|heading|cta';
  for (const match of source.matchAll(
    new RegExp(`\\b(?:${COPY_KEYS})\\s*[=:]\\s*\\{?['"\`]([^'"\`]+)['"\`]`, 'g'),
  )) {
    const text = match[1] as string;
    if (!CODE_SIGNS.test(text)) copy.push(text);
  }

  return copy;
}

describe('one noun per concept', () => {
  const files = UI_DIRS.flatMap(sourceFiles);

  it('scans a plausible number of files', () => {
    // Guards the guard: a broken walk would pass everything silently.
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files)('%s uses no retired job noun', (file) => {
    const body = stripComments(fs.readFileSync(path.join(process.cwd(), file), 'utf8'));

    for (const { pattern, instead } of RETIRED) {
      const match = body.match(pattern);
      expect(
        match
          ? `${file} says "${match[0]}" in user-facing copy — use "${instead}" (see CLAUDE.md)`
          : null,
      ).toBeNull();
    }
  });
});

/**
 * `job` is the code word for the domain object and must not reach the screen.
 * CLAUDE.md: "code only — the Mongoose model, the collection, /jobs and
 * /api/jobs routes, params, component and file names. Never appears in new
 * user-facing copy." Use "role" for the work and "listing" for the published
 * record advertising it.
 */
describe('"job" stays in the code and out of the copy', () => {
  const files = UI_DIRS.flatMap(sourceFiles);

  it('finds copy to check, so the extractor cannot pass by finding nothing', () => {
    // Guards the guard. If extractCopy() ever silently returns [], every file
    // below passes and the rule quietly stops being enforced — which is exactly
    // how this one went unnoticed the first time.
    const all = files.flatMap((file) =>
      extractCopy(fs.readFileSync(path.join(process.cwd(), file), 'utf8')),
    );
    expect(all.length).toBeGreaterThan(200);
    expect(all).toContain('My listings');
  });

  it.each(files)('%s says role or listing, never job', (file) => {
    const source = stripComments(fs.readFileSync(path.join(process.cwd(), file), 'utf8'));

    const offenders = extractCopy(source).filter((text) => /\bjobs?\b/i.test(text));

    expect(
      offenders.length > 0
        ? `${file} shows "${offenders[0]}" to the user — "job" is code only; ` +
            'say "role" for the work or "listing" for the posted record (see CLAUDE.md)'
        : null,
    ).toBeNull();
  });
});

/**
 * The error defaults in errors.ts are what a user sees when a service throws
 * without its own message, so they are product copy and must not read like a
 * REST library.
 */
describe('error copy is written for people', () => {
  const errorSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/api/errors.ts'), 'utf8');

  it.each(['Resource', 'Malformed', 'Invalid request payload'])(
    'does not fall back to "%s"',
    (jargon) => {
      expect(stripComments(errorSource)).not.toContain(jargon);
    },
  );
});
