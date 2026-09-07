const express = require("express");
const {
  loginRateLimiter,
} = require("../middleware/loginRateLimitMiddleware");

const {
  registrationRateLimiter,
} = require("../middleware/registrationRateLimitMiddleware");

const {
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
} = require("../middleware/passwordResetRateLimitMiddleware");

const {
  resendEmailVerificationRateLimiter,
  verifyEmailVerificationRateLimiter,
} = require(
  "../middleware/emailVerificationRateLimitMiddleware"
);

const router = express.Router();


const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  resendEmailVerification,
  verifyEmail,
  getMe,
  createTenantAdmin,
} = require("../controllers/authController");

const { protect, authorize } = require("../middleware/authMiddleware");

const {
  requirePublicRegistrationAvailable,
} = require("../middleware/publicRegistrationMiddleware");

const {
  resolvePublicRegistrationTenant,
} = require("../middleware/registrationTenantMiddleware");

const {
  validatePublicStudentRegistration,
} = require("../middleware/registrationValidationMiddleware");

const {
  checkStudentLimit,
} = require("../middleware/tenantLimitMiddleware");

// Register
router.post(
  "/register",
  requirePublicRegistrationAvailable,
  registrationRateLimiter,
  validatePublicStudentRegistration,
  resolvePublicRegistrationTenant,
  checkStudentLimit,
  registerUser
);
 

// Login
router.post(
  "/login",
  loginRateLimiter,
  loginUser
);

// Forgot Password
router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  forgotPassword
);

// Reset Password
router.post(
  "/reset-password",
  resetPasswordRateLimiter,
  resetPassword
);

// Resend Email Verification
router.post(
  "/resend-email-verification",
  resendEmailVerificationRateLimiter,
  resendEmailVerification
);

// Verify Email
router.post(
  "/verify-email",
  verifyEmailVerificationRateLimiter,
  verifyEmail
);

router.get("/me", protect, getMe);


router.post(
  "/create-tenant-admin",
  protect,
  authorize("super_admin"),
  createTenantAdmin
);

module.exports = router;
