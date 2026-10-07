const {
  rateLimit,
  ipKeyGenerator,
} = require("express-rate-limit");

const {
  getLoginRateLimitClientIp,
} = require("./loginRateLimitMiddleware");

const REGISTRATION_RATE_LIMIT_WINDOW_MS =
  15 * 60 * 1000;

const REGISTRATION_RATE_LIMIT_MAX_REQUESTS = 20;

const registrationRateLimiter = rateLimit({
  windowMs: REGISTRATION_RATE_LIMIT_WINDOW_MS,

  limit: REGISTRATION_RATE_LIMIT_MAX_REQUESTS,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  keyGenerator: (req) =>
    ipKeyGenerator(
      getLoginRateLimitClientIp(req),
      56
    ),

  message: {
    success: false,
    message:
      "Too many registration attempts. Please try again later.",
  },
});

module.exports = {
  REGISTRATION_RATE_LIMIT_WINDOW_MS,
  REGISTRATION_RATE_LIMIT_MAX_REQUESTS,
  registrationRateLimiter,
};