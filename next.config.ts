import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  experimental: { cpus: 2 },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ] }, { source: '/auth/:path*', headers: [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }, { source: '/studio/:path*', headers: [
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }, ...(process.env.FABELPAD_DEPLOY_ENV === 'production' ? [] : [{ source: '/blog/:path*', headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }])];
  },
};
export default config;
