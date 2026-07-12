const express = require("express");
const router = express.Router();

const {
  createCategory,
  getPublicCategories,
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

router.get("/public", getPublicCategories);

router.post(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  ensureTenantAccess,
  createCategory
);

router.get(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  getAllCategories
);

router.put(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  ensureTenantAccess,
  updateCategory
);

router.delete(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin"),
  ensureTenantAccess,
  deleteCategory
);

module.exports = router;
