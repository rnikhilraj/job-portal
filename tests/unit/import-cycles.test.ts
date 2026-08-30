import fs from 'node:fs';
import path from 'node:path';

/**
 * `src/` must contain no import cycles.
 *
 * `job.service` and `application.service` used to import each other: deleting a
 * listing cascades into its applications, and reading an applicant pipeline
 * needs the listing's owner. It worked only because ESM hoists function
 * declarations — the modules were mutually dependent and happened to evaluate
 * in a surviving order. The shared ownership check now lives in
 * `job.ownership.ts` and both depend on that instead.
 *
 * A cycle is not always fatal, which is exactly why it needs a test: it fails
 * later, under a different bundler or after an unrelated reorder, and by then
 * the cause is not obvious. This walks the real graph and fails on any cycle,
 * printing the loop rather than just its existence.
 */
const SOURCE_ROOT = path.join(process.cwd(), 'src');
const EXTENSIONS = ['.ts', '.tsx'];

/** Matches `import … from '…'`, bare `import '…'` and `export … from '…'`. */
const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;

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

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return EXTENSIONS.includes(path.extname(entry.name)) ? [full] : [];
  });
}

function buildGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const file of sourceFiles(SOURCE_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    const dependencies: string[] = [];
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const resolved = resolveModule(match[1] as string, file);
      if (resolved) dependencies.push(resolved);
    }
    graph.set(file, dependencies);
  }
  return graph;
}

/** Every cycle in the graph, each as the chain of files that closes the loop. */
function findCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const VISITING = 1;
  const DONE = 2;
  const state = new Map<string, number>();

  function visit(node: string, stack: string[]): void {
    state.set(node, VISITING);
    stack.push(node);

    for (const dependency of graph.get(node) ?? []) {
      if (state.get(dependency) === VISITING) {
        cycles.push([...stack.slice(stack.indexOf(dependency)), dependency]);
      } else if (!state.has(dependency)) {
        visit(dependency, stack);
      }
    }

    stack.pop();
    state.set(node, DONE);
  }

  for (const file of graph.keys()) {
    if (!state.has(file)) visit(file, []);
  }
  return cycles;
}

describe('module graph', () => {
  const graph = buildGraph();

  it('walks a plausible number of modules', () => {
    // Guards against the walk silently finding nothing and passing vacuously.
    expect(graph.size).toBeGreaterThan(40);
  });

  it('contains no import cycles', () => {
    const relative = (file: string) => path.relative(process.cwd(), file);
    const rendered = findCycles(graph).map((cycle) => cycle.map(relative).join('\n    -> '));

    expect(rendered).toEqual([]);
  });

  it('keeps the applications domain off job.service', () => {
    // The specific edge that used to close the loop. It is asserted by name as
    // well as by the general walk, so a regression says what broke.
    const applicationService = path.join(
      SOURCE_ROOT,
      'modules/applications/application.service.ts',
    );
    const jobService = path.join(SOURCE_ROOT, 'modules/jobs/job.service.ts');

    expect(graph.get(applicationService)).not.toContain(jobService);
  });
});
