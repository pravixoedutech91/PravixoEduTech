const express = require("express");
const router = express.Router();

const {
  protect,
  authorize,

} = require("../middleware/authMiddleware");


const {
  createTenant,
  getAllTenants,
  updateTenant,
} = require("../controllers/tenantController");

// Create Tenant
router.post(
  "/",
  protect,
  authorize("super_admin"),
  createTenant
);

// Get All Tenants
router.get(
  "/",
  protect,
  authorize("super_admin"),
  getAllTenants
);
router.put(
  "/:id",
  protect,
  authorize("super_admin"),
  updateTenant
);

module.exports = router;