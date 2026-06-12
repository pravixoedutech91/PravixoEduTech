const express = require("express");
const router = express.Router();

const {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
} = require("../middleware/tenantMiddleware");

// Create Category
router.post(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  ensureTenantAccess,
  createCategory
);

// Get All Categories
router.get(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  getAllCategories
);

// Update Category
router.put(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  ensureTenantAccess,
  updateCategory
);

// Delete Category
router.delete(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin"),
  ensureTenantAccess,
  deleteCategory
);

module.exports = router;