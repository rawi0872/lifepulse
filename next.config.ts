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

const cspDev = `
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://apis.google.com https://www.googleapis.com;
  frame-src 'self' https://docs.google.com https://drive.google.com https://accounts.google.com;
  frame-ancestors 'none';
  form-action 'self';
`;

const cspProd = `
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  script-src 'self' 'unsafe-inline' https://apis.google.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://apis.google.com https://www.googleapis.com;
  frame-src 'self' https://docs.google.com https://drive.google.com https://accounts.google.com;
  frame-ancestors 'none';
  form-action 'self';
  upgrade-insecure-requests;
`;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/favicon.ico", destination: "/icon.svg" },
    ];
  },
  headers: async () => {
    const isDev = process.env.NODE_ENV === "development";
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          ...(isDev ? [] : [{
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          }]),
          {
            key: "Content-Security-Policy",
            value: (isDev ? cspDev : cspProd).replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
