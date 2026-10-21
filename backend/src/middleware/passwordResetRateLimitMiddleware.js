const {
  rateLimit,
  ipKeyGenerator,
} = require("express-rate-limit");

const {
  getLoginRateLimitClientIp,
} = require("./loginRateLimitMiddleware");

const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS =
  15 * 60 * 1000;

const FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS = 5;

const RESET_PASSWORD_RATE_LIMIT_MAX_FAILURES = 10;

const getPasswordResetRateLimitKey = (req) => {
  return ipKeyGenerator(
    getLoginRateLimitClientIp(req),
    56
  );
};

const forgotPasswordRateLimiter = rateLimit({
  windowMs:
    PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,

  limit:
    FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  /*
   * Every forgot-password request counts.
   *
   * This endpoint can cause outbound email delivery,
   * so successful-looking generic responses must not
   * bypass abuse protection.
   */
  keyGenerator:
    getPasswordResetRateLimitKey,

  message: {
    success: false,
    message:
      "Too many password recovery requests. Please try again later.",
  },
});

const resetPasswordRateLimiter = rateLimit({
  windowMs:
    PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,

  limit:
    RESET_PASSWORD_RATE_LIMIT_MAX_FAILURES,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  /*
   * Successful resets do not consume the failure budget.
   *
   * Server-side failures also do not punish the client.
   * Only 4xx reset failures count toward this limiter.
   */
  skipSuccessfulRequests: true,

  requestWasSuccessful: (req, res) =>
    res.statusCode < 400 ||
    res.statusCode >= 500,

  keyGenerator:
    getPasswordResetRateLimitKey,

  message: {
    success: false,
    message:
      "Too many password reset attempts. Please try again later.",
  },
});

module.exports = {
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS,
  RESET_PASSWORD_RATE_LIMIT_MAX_FAILURES,
  getPasswordResetRateLimitKey,
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
};
