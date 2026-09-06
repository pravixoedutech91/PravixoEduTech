const net =
  require("net");

const {
  rateLimit,
  ipKeyGenerator,
} = require(
  "express-rate-limit"
);

const isRailwayEnvironment =
  () =>
    Boolean(
      process.env
        .RAILWAY_ENVIRONMENT_NAME ||
      process.env
        .RAILWAY_DEPLOYMENT_ID
    );

const EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MS =
  15 * 60 * 1000;

const EMAIL_VERIFICATION_RESEND_MAX_REQUESTS =
  20;

const EMAIL_VERIFICATION_VERIFY_MAX_REQUESTS =
  60;

const normalizeIpAddress = (
  value
) => {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  let candidate =
    value.trim();

  if (!candidate) {
    return "";
  }

  if (
    candidate.startsWith(
      "::ffff:"
    ) &&
    net.isIP(
      candidate.slice(7)
    ) === 4
  ) {
    candidate =
      candidate.slice(7);
  }

  return net.isIP(
    candidate
  )
    ? candidate
    : "";
};

const getFirstForwardedIp = (
  value
) => {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  const firstValue =
    value.split(",")[0];

  return normalizeIpAddress(
    firstValue
  );
};

const getEmailVerificationRateLimitClientIp =
  (req) => {
    /*
     * Preserve the existing Pravixo proxy/IP model:
     * forwarded headers are trusted only when Railway's
     * runtime markers are present.
     */
    if (
      isRailwayEnvironment()
    ) {
      const forwardedIp =
        getFirstForwardedIp(
          req &&
            req.headers &&
            req.headers[
              "x-forwarded-for"
            ]
        );

      if (forwardedIp) {
        return forwardedIp;
      }

      const realIp =
        normalizeIpAddress(
          req &&
            req.headers &&
            req.headers[
              "x-real-ip"
            ]
        );

      if (realIp) {
        return realIp;
      }
    }

    const expressIp =
      normalizeIpAddress(
        req &&
          req.ip
      );

    if (expressIp) {
      return expressIp;
    }

    const socketIp =
      normalizeIpAddress(
        req &&
          req.socket &&
          req.socket
            .remoteAddress
      );

    if (socketIp) {
      return socketIp;
    }

    /*
     * Fail closed into one shared anonymous bucket rather
     * than deriving authority from email/mobile/token input.
     */
    return "0.0.0.0";
  };

const createEmailVerificationIpLimiter =
  ({
    limit,
    message,
  }) =>
    rateLimit({
      windowMs:
        EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MS,

      limit,

      standardHeaders:
        "draft-7",

      legacyHeaders:
        false,

      /*
       * Deliberately count successful-looking responses.
       *
       * Resend endpoints use generic public responses for
       * enumeration resistance, so skipSuccessfulRequests
       * would otherwise make abuse effectively unlimited.
       */
      keyGenerator: (req) =>
        ipKeyGenerator(
          getEmailVerificationRateLimitClientIp(
            req
          ),
          56
        ),

      message: {
        success: false,
        message,
      },
    });

const resendEmailVerificationRateLimiter =
  createEmailVerificationIpLimiter({
    limit:
      EMAIL_VERIFICATION_RESEND_MAX_REQUESTS,

    message:
      "Too many verification email requests. Please try again later.",
  });

const verifyEmailVerificationRateLimiter =
  createEmailVerificationIpLimiter({
    limit:
      EMAIL_VERIFICATION_VERIFY_MAX_REQUESTS,

    message:
      "Too many email verification attempts. Please try again later.",
  });

module.exports = {
  isRailwayEnvironment,
  EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MS,
  EMAIL_VERIFICATION_RESEND_MAX_REQUESTS,
  EMAIL_VERIFICATION_VERIFY_MAX_REQUESTS,
  normalizeIpAddress,
  getFirstForwardedIp,
  getEmailVerificationRateLimitClientIp,
  resendEmailVerificationRateLimiter,
  verifyEmailVerificationRateLimiter,
};
