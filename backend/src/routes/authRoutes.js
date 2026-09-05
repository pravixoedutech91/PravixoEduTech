const express = require("express");
const {
  loginRateLimiter,
} = require("../middleware/loginRateLimitMiddleware");

const {
  registrationRateLimiter,
} = require("../middleware/registrationRateLimitMiddleware");

const router = express.Router();


const {
  registerUser,
  loginUser,
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

router.get("/me", protect, getMe);


router.post(
  "/create-tenant-admin",
  protect,
  authorize("super_admin"),
  createTenantAdmin
);

module.exports = router;
