import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/coach", destination: "/nextron", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/favicon.ico", destination: "/icon.svg" },
    ];
  },
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
