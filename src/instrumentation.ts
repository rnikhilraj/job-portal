/**
 * Next.js runs `register()` once when the server starts.
 *
 * The real work lives in instrumentation.node.ts and is reached through a
 * dynamic import nested inside a positive `=== 'nodejs'` check. That exact
 * shape matters: Next compiles this file for the Edge runtime as well, and only
 * the positive form lets webpack eliminate the branch. With a negated guard it
 * still tries to resolve the module graph behind it, which fails the build as
 * soon as anything in it touches a `node:` builtin.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}
