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

const router = express.Router();


const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
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

router.get("/me", protect, getMe);


router.post(
  "/create-tenant-admin",
  protect,
  authorize("super_admin"),
  createTenantAdmin
);

module.exports = router;
