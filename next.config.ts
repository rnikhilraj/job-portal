import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Content Security Policy.
 *
 * Be clear about what this does and does not buy, because the two inline
 * allowances are not equivalent:
 *
 * - `style-src 'unsafe-inline'` is unavoidable and low risk. Next injects
 *   inline `<style>` for its CSS and next/font emits inline font declarations.
 *
 * - `script-src 'unsafe-inline'` IS a real weakening, and naming it as anything
 *   else would be dishonest. It permits inline `<script>`, which is the main
 *   thing a script-src is meant to stop, so this policy is not an XSS control —
 *   it is defence in depth behind the app's actual control, which is that every
 *   user-supplied string renders as text and never as HTML. Next's App Router
 *   emits inline bootstrap and streaming-payload scripts; removing the
 *   allowance means issuing a per-request nonce from middleware and threading
 *   it through, which is the right fix and is listed as a known limitation.
 *   `'unsafe-eval'` is separate and is development-only, for the dev bundler.
 *
 * The directives that do carry weight here are the last four. This app takes
 * PDF uploads and serves them back, so it forbids being framed, forbids
 * embedding anything as an object or plugin, pins form submissions and
 * connections to its own origin, and blocks `<base>` rewriting.
 */
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self'${isProduction ? '' : " 'unsafe-eval'"} 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // No third-party APIs are called, so nothing outside this origin is needed.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the Docker runtime stage does not
  // need node_modules or the Next CLI.
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Mongoose ships optional native/dynamic requires that must not be bundled
  // into the server build.
  serverExternalPackages: ['mongoose'],
  async headers() {
    const baseSecurityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ...(isProduction
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
        : []),
    ];

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
          ...baseSecurityHeaders,
        ],
      },
      /*
       * Resume downloads get a far stricter policy than the rest of the app.
       *
       * This rule is listed after the catch-all deliberately: a next.config
       * header overrides one set inside a route handler, and the later matching
       * rule wins. Without it, the app-wide CSP silently replaced the
       * `default-src 'none'; sandbox` the download route sets for itself —
       * which is exactly what happened when the app-wide policy was introduced.
       */
      {
        source: '/api/:path*/resume',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
          ...baseSecurityHeaders,
        ],
      },
      {
        source: '/api/users/me/resume',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
          ...baseSecurityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
