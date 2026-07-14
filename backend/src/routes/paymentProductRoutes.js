const express = require("express");
const router = express.Router();

const {
  getPaymentProducts,
  getPaymentProductById,
  createPaymentProduct,
  updatePaymentProduct,
  disablePaymentProduct,
  reactivatePaymentProduct,
} = require("../controllers/paymentProductController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
  checkFeatureAccess,
} = require("../middleware/tenantMiddleware");

const billingAdminRoles = ["super_admin", "tenant_admin"];

router.get(
  "/",
  protect,
  authorize(...billingAdminRoles),
  checkFeatureAccess("mockTests"),
  getPaymentProducts
);

router.post(
  "/",
  protect,
  authorize(...billingAdminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  createPaymentProduct
);

router.get(
  "/:id",
  protect,
  authorize(...billingAdminRoles),
  checkFeatureAccess("mockTests"),
  getPaymentProductById
);

router.put(
  "/:id",
  protect,
  authorize(...billingAdminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  updatePaymentProduct
);

router.patch(
  "/:id/disable",
  protect,
  authorize(...billingAdminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  disablePaymentProduct
);

router.patch(
  "/:id/reactivate",
  protect,
  authorize(...billingAdminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  reactivatePaymentProduct
);

module.exports = router;
