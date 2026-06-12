const express = require("express");
const router = express.Router();

const {
  createContent,
  getAllContent,
  getContentBySlug,
  updateContent,
  deleteContent,
  getAdminContentList,
} = require("../controllers/contentController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
  checkContentFeatureAccess,
} = require("../middleware/tenantMiddleware");

// Create Content
router.post(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  ensureTenantAccess,
  checkContentFeatureAccess,
  createContent
);


// Get All Content
router.get("/", getAllContent);

router.get(
  "/admin/list",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  getAdminContentList
);

// Get Single Content By Slug
router.get("/:slug", getContentBySlug);

//update content
router.put(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  ensureTenantAccess,
  updateContent
);

//delete content
router.delete(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin"),
  ensureTenantAccess,
  deleteContent
);

module.exports = router;