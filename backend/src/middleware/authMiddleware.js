const { logRuntimeError } = require("../utils/runtimeSecurity");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const PROTECT_EMAIL_VERIFICATION_REQUIRED_CODE =
  "EMAIL_VERIFICATION_REQUIRED";

const PROTECT_EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Please verify your email before continuing.";

// Protect Routes
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // One Device Login Check
    if (
      decoded.sessionId !== user.activeSessionId
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Session expired. Logged in from another device.",
      });
    }

    /*
     * Session authority must be proven before
     * student email-verification state is exposed.
     */
    if (
      user.role === "student" &&
      user.isEmailVerified !== true
    ) {
      return res.status(403).json({
        success: false,
        code:
          PROTECT_EMAIL_VERIFICATION_REQUIRED_CODE,
        message:
          PROTECT_EMAIL_VERIFICATION_REQUIRED_MESSAGE,
      });
    }

    req.authSessionId = decoded.sessionId;
    req.user = user;

    next();
  } catch (error) {
    logRuntimeError("authMiddleware error:", error);

    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }
};

// Role Authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};