const net = require("net");
const {
  rateLimit,
  ipKeyGenerator,
} = require("express-rate-limit");
const isRailwayEnvironment = () =>
  Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_DEPLOYMENT_ID
  );

const LOGIN_RATE_LIMIT_WINDOW_MS =
  15 * 60 * 1000;

const LOGIN_RATE_LIMIT_MAX_FAILURES = 30;

const normalizeIpAddress = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  let candidate = value.trim();

  if (!candidate) {
    return "";
  }

  if (
    candidate.startsWith("::ffff:") &&
    net.isIP(candidate.slice(7)) === 4
  ) {
    candidate = candidate.slice(7);
  }

  return net.isIP(candidate)
    ? candidate
    : "";
};

const getFirstForwardedIp = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const firstValue =
    value.split(",")[0];

  return normalizeIpAddress(firstValue);
};

const getLoginRateLimitClientIp = (req) => {
  if (isRailwayEnvironment()) {
    const forwardedIp =
      getFirstForwardedIp(
        req &&
        req.headers &&
        req.headers["x-forwarded-for"]
      );

    if (forwardedIp) {
      return forwardedIp;
    }

    const realIp =
      normalizeIpAddress(
        req &&
        req.headers &&
        req.headers["x-real-ip"]
      );

    if (realIp) {
      return realIp;
    }
  }

  const expressIp =
    normalizeIpAddress(
      req && req.ip
    );

  if (expressIp) {
    return expressIp;
  }

  const socketIp =
    normalizeIpAddress(
      req &&
      req.socket &&
      req.socket.remoteAddress
    );

  if (socketIp) {
    return socketIp;
  }

  return "0.0.0.0";
};

const loginRateLimiter = rateLimit({
  windowMs:
    LOGIN_RATE_LIMIT_WINDOW_MS,

  limit:
    LOGIN_RATE_LIMIT_MAX_FAILURES,

  standardHeaders: "draft-7",
  legacyHeaders: false,

  skipSuccessfulRequests: true,

  requestWasSuccessful: (req, res) =>
    res.statusCode < 400 ||
    res.statusCode >= 500,

  keyGenerator: (req) =>
    ipKeyGenerator(
      getLoginRateLimitClientIp(req),
      56
    ),

  message: {
    success: false,
    message:
      "Too many login attempts. Please try again later.",
  },
});

module.exports = {
  isRailwayEnvironment,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  normalizeIpAddress,
  getFirstForwardedIp,
  getLoginRateLimitClientIp,
  loginRateLimiter,
};
