const express = require("express");
const router = express.Router();

const {
  createContent,
  getAllContent,
  getContentBySlug,
  getPublicContentList,
  getPublicContentBySlug,
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

router.get("/public", getPublicContentList);
router.get("/public/:slug", getPublicContentBySlug);

router.post(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  ensureTenantAccess,
  checkContentFeatureAccess,
  createContent
);

router.get("/", getAllContent);

router.get(
  "/admin/list",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  getAdminContentList
);

router.get("/:slug", getContentBySlug);

router.put(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  ensureTenantAccess,
  updateContent
);

router.delete(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin"),
  ensureTenantAccess,
  deleteContent
);

module.exports = router;
