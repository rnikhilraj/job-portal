import fs from 'node:fs';
import path from 'node:path';

/**
 * Client components share zod schemas and constants with the server. If one of
 * those shared modules ever imports a model file, Mongoose is pulled into the
 * browser bundle — that regression once shipped a 576 kB driver chunk to every
 * job page before it was caught.
 *
 * The figure is not folklore: reintroducing it by pointing one client component
 * at `job.model` instead of `job.constants` takes the built client chunks under
 * `.next/static/chunks` from 701,151 to 1,287,403 bytes, an added 586,252 bytes
 * across one extra chunk.
 *
 * This walks the real import graph from each client entry point and fails if it
 * reaches Mongoose.
 */
const SOURCE_ROOT = path.join(process.cwd(), 'src');
const EXTENSIONS = ['.ts', '.tsx'];

/** Every module that is (or is reachable from) a `'use client'` component. */
const CLIENT_ENTRY_POINTS = [
  'src/components/job-form.tsx',
  'src/components/job-filters.tsx',
  'src/components/hr-job-filters.tsx',
  'src/components/job-card.tsx',
  'src/components/apply-form.tsx',
  'src/components/applicant-status-select.tsx',
  'src/components/profile-form.tsx',
  'src/components/profile-resume.tsx',
  'src/components/pipeline-hero.tsx',
  'src/components/pipeline-rail.tsx',
  'src/components/reveal.tsx',
  'src/components/route-transition.tsx',
  'src/components/candidate-summary.tsx',
  'src/components/site-header.tsx',
  'src/components/status-badge.tsx',
  'src/components/logout-button.tsx',
  'src/components/mobile-nav.tsx',
  'src/components/delete-job-button.tsx',
  'src/app/(auth)/login/login-form.tsx',
  'src/app/(auth)/signup/signup-form.tsx',
  'src/middleware.ts',
];

const FORBIDDEN_PACKAGES = ['mongoose', 'bcryptjs', 'jose'];

/**
 * Node builtins break the client and Edge bundles outright. `src/instrumentation.ts`
 * is deliberately not an entry point here: it reaches them on purpose, behind a
 * `process.env.NEXT_RUNTIME === 'nodejs'` branch that webpack eliminates, which a
 * static walk cannot model. `npm run build` is the guard for that one.
 */
const isNodeBuiltin = (specifier: string) =>
  specifier.startsWith('node:') ||
  ['fs', 'path', 'crypto', 'os', 'child_process'].includes(specifier);

/** Matches both `import … from '…'` and bare `import '…'`, type imports included. */
const IMPORT_PATTERN = /(?:^|\n)\s*import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;

function resolveModule(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = path.join(SOURCE_ROOT, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null; // a package, not a local file
  }

  for (const candidate of [
    ...EXTENSIONS.map((extension) => `${base}${extension}`),
    ...EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Returns the chain of files leading to a forbidden package, or null. */
function findForbiddenImport(entry: string): { chain: string[]; pkg: string } | null {
  const visited = new Set<string>();
  const queue: Array<{ file: string; chain: string[] }> = [
    { file: path.join(process.cwd(), entry), chain: [entry] },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.file)) continue;
    visited.add(current.file);

    const source = fs.readFileSync(current.file, 'utf8');
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (!specifier) continue;

      const forbidden = FORBIDDEN_PACKAGES.find(
        (pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`),
      );
      if (forbidden) {
        return { chain: current.chain, pkg: forbidden };
      }
      if (isNodeBuiltin(specifier)) {
        return { chain: current.chain, pkg: specifier };
      }

      const resolved = resolveModule(specifier, current.file);
      if (resolved) {
        queue.push({
          file: resolved,
          chain: [...current.chain, path.relative(process.cwd(), resolved)],
        });
      }
    }
  }
  return null;
}

describe('client bundle boundary', () => {
  it.each(CLIENT_ENTRY_POINTS)('%s does not reach a server-only package', (entry) => {
    expect(fs.existsSync(path.join(process.cwd(), entry))).toBe(true);

    const violation = findForbiddenImport(entry);
    const detail = violation
      ? `${entry} reaches "${violation.pkg}" via:\n  ${violation.chain.join('\n  → ')}`
      : '';

    expect(detail).toBe('');
  });
});
