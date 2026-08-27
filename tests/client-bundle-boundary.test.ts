import fs from 'node:fs';
import path from 'node:path';

/**
 * Client components share zod schemas and constants with the server. If one of
 * those shared modules ever imports a model file, Mongoose is pulled into the
 * browser bundle — that regression once added ~160 kB of driver code to every
 * job page before it was caught.
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
  'src/components/site-header.tsx',
  'src/components/status-badge.tsx',
  'src/components/logout-button.tsx',
  'src/app/(auth)/login/login-form.tsx',
  'src/app/(auth)/signup/signup-form.tsx',
  'src/middleware.ts',
];

const FORBIDDEN_PACKAGES = ['mongoose', 'bcryptjs', 'jose'];

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
