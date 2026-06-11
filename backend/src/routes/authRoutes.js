const express = require("express");
const router = express.Router();


const {
  registerUser,
  loginUser,
  getMe,
  createTenantAdmin,
  //createSuperAdmin,
} = require("../controllers/authController");

const { protect, authorize } = require("../middleware/authMiddleware");

// Register
router.post("/register", registerUser);
 

// Login
router.post("/login", loginUser);

router.get("/me", protect, getMe);

//create super Admin
//router.post("/create-super-admin", createSuperAdmin);

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