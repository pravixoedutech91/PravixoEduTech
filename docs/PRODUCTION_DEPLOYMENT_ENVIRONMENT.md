# PravixoEduTech Production Deployment Environment

This document defines the environment-variable contract for the Railway backend and Vercel frontend.

## Security rules

- Never commit real production secrets or environment files.
- Configure secrets directly in Railway or Vercel.
- Hosted URLs must contain only an origin such as https://api.example.com.
- Do not append /api, another path, a query string or a hash.
- Never use localhost in hosted deployments.
- Never use a wildcard for backend CORS.

## Railway backend

### Required

    NODE_ENV=production
    MONGODB_URI=<production MongoDB connection string>
    JWT_SECRET=<long random production secret>

Changing JWT_SECRET invalidates existing login tokens.

### Required frontend-origin configuration

For one exact frontend origin:

    FRONTEND_URL=https://www.example.com

For multiple exact frontend origins:

    ALLOWED_ORIGINS=https://www.example.com,https://example.com

Both variables may be present. Their origins are combined.

### Recommended explicit public tenant

    PUBLIC_TENANT_ID=pravixoedutech

### Required when Razorpay payments are enabled

    RAZORPAY_KEY_ID=<Razorpay key ID>
    RAZORPAY_KEY_SECRET=<Razorpay key secret>

Razorpay secret values must remain backend-only.

### Railway-managed variables

    PORT
    RAILWAY_ENVIRONMENT_NAME
    RAILWAY_DEPLOYMENT_ID

Railway provides these values during deployment.

## Vercel frontend

### Required

    NEXT_PUBLIC_API_BASE_URL=https://api.example.com
    NEXT_PUBLIC_SITE_URL=https://www.example.com

NEXT_PUBLIC_API_BASE_URL must contain the Railway backend origin.

NEXT_PUBLIC_SITE_URL must contain the canonical frontend origin used by metadata, robots, sitemap and structured public URLs.

### Legacy optional alias

    NEXT_PUBLIC_API_URL=https://api.example.com

Prefer leaving NEXT_PUBLIC_API_URL unset. When both API variables exist, they must resolve to the same origin.

VERCEL and VERCEL_ENV are supplied by Vercel and activate hosted-build validation.

## Recommended deployment order

1. Configure Railway database, JWT, tenant and Razorpay variables.
2. Configure the intended frontend origin in Railway.
3. Deploy the Railway backend.
4. Copy the exact Railway public origin.
5. Configure NEXT_PUBLIC_API_BASE_URL in Vercel.
6. Configure NEXT_PUBLIC_SITE_URL in Vercel.
7. Deploy the Vercel frontend.
8. Verify public content, sitemap, login and Mock Tests.
9. Verify Razorpay checkout and backend payment verification.
10. Confirm an untrusted browser origin receives no CORS permission.

## Domain changes

For a frontend-domain change, update:

    Railway: FRONTEND_URL or ALLOWED_ORIGINS
    Vercel: NEXT_PUBLIC_SITE_URL

For a backend-domain change, update:

    Vercel: NEXT_PUBLIC_API_BASE_URL
