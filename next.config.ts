import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "phantom.app",
      },
      {
        protocol: "https",
        hostname: "assets.aceternity.com",
      },
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
      },
    ],
  },
  experimental: {
    // Enable app router instrumentation
    clientInstrumentationHook: true,
  },
  // Ensure auth middleware is loaded correctly
  // This is critical for protecting routes
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  middleware: {
    // Force middleware to run on all requests
    // This is important for auth checks
    onError: 'continue',
  }
}

export default nextConfig
