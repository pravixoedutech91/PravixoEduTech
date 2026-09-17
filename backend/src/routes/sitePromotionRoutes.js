const express = require("express");

const router = express.Router();

const {
  getActivePromotion,
  getActiveStudentPromotion,
  getAdminPromotions,
  getAdminPromotionById,
  createPromotion,
  updatePromotion,
} = require("../controllers/sitePromotionController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
} = require("../middleware/tenantMiddleware");

const promotionAdminRoles = [
  "super_admin",
  "tenant_admin",
];

router.get(
  "/active",
  getActivePromotion
);

router.get(
  "/student/active",
  protect,
  authorize("student"),
  getActiveStudentPromotion
);

router.get(
  "/admin",
  protect,
  authorize(...promotionAdminRoles),
  getAdminPromotions
);

router.get(
  "/admin/:id",
  protect,
  authorize(...promotionAdminRoles),
  getAdminPromotionById
);

router.post(
  "/",
  protect,
  authorize(...promotionAdminRoles),
  ensureTenantAccess,
  createPromotion
);

router.put(
  "/:id",
  protect,
  authorize(...promotionAdminRoles),
  ensureTenantAccess,
  updatePromotion
);

module.exports = router;
