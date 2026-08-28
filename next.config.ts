import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Content Security Policy.
 *
 * `'unsafe-inline'` for styles is unavoidable here: Next injects inline
 * `<style>` for its CSS and next/font emits inline font declarations. Scripts
 * are the part that matters for XSS, and those are restricted to same-origin —
 * with `'unsafe-eval'` allowed in development only, because the dev bundler
 * needs it and production does not.
 *
 * The interesting directives are the last three. This app takes PDF uploads and
 * serves them back, so it explicitly forbids being framed, forbids embedding
 * anything as an object or plugin, and pins form submissions to its own origin.
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
