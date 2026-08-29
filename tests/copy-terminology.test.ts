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
