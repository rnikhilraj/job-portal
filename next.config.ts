import type { NextConfig } from 'next';

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
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
