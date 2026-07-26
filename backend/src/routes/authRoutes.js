const express = require("express");
const {
  loginRateLimiter,
} = require("../middleware/loginRateLimitMiddleware");

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
  checkStudentLimit,
} = require("../middleware/tenantLimitMiddleware");

// Register
router.post(
  "/register",
  requirePublicRegistrationAvailable,
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

router.get(
  "/super-admin-test",
  protect,
  authorize("super_admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Super Admin access granted",
      user: {
        id: req.user._id,
        role: req.user.role,
      },
    });
  }
);

module.exports = router;