import type { NextConfig } from "next";

const isHostedFrontendBuild =
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL_ENV) ||
  process.env.WORKERS_CI === "1";

const normalizeHostedOrigin = (
  variableName: string,
  value?: string
) => {
  const configuredValue = value?.trim();

  if (!configuredValue) {
    throw new Error(
      `Missing ${variableName} in hosted frontend build`
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(configuredValue);
  } catch {
    throw new Error(
      `${variableName} must be a valid absolute URL`
    );
  }

  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      `${variableName} must use http or https`
    );
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(
      `${variableName} must not contain URL credentials`
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  ) {
    throw new Error(
      `${variableName} must not use localhost in a hosted build`
    );
  }

  if (
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      `${variableName} must contain only an origin without a path, query or hash`
    );
  }

  return parsedUrl.origin;
};

if (isHostedFrontendBuild) {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  const legacyApiUrl =
    process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!apiBaseUrl && !legacyApiUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL in hosted frontend build"
    );
  }

  const normalizedApiBaseUrl = apiBaseUrl
    ? normalizeHostedOrigin(
        "NEXT_PUBLIC_API_BASE_URL",
        apiBaseUrl
      )
    : "";

  const normalizedLegacyApiUrl = legacyApiUrl
    ? normalizeHostedOrigin(
        "NEXT_PUBLIC_API_URL",
        legacyApiUrl
      )
    : "";

  if (
    normalizedApiBaseUrl &&
    normalizedLegacyApiUrl &&
    normalizedApiBaseUrl !== normalizedLegacyApiUrl
  ) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_API_URL must use the same origin"
    );
  }

  normalizeHostedOrigin(
    "NEXT_PUBLIC_SITE_URL",
    process.env.NEXT_PUBLIC_SITE_URL
  );
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
