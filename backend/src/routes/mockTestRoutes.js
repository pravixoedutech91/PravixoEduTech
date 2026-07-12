const express = require("express");
const router = express.Router();

const {
  createMockTest,
  getAllMockTests,
  getSingleMockTest,
  getMockTestVersions,
  updateMockTest,
  disableMockTest,
  publishMockTest,
  unpublishMockTest,
} = require("../controllers/mockTestController");

const { protect, authorize } = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
  checkFeatureAccess,
} = require("../middleware/tenantMiddleware");

const adminRoles = ["super_admin", "tenant_admin", "content_admin"];

// Create Mock Test
router.post(
  "/",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  createMockTest
);

// Get All Mock Tests
router.get(
  "/",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  getAllMockTests
);

// Get Mock Test Published Versions
router.get(
  "/:id/versions",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  getMockTestVersions
);

// Get Single Mock Test
router.get(
  "/:id",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  getSingleMockTest
);

// Update Mock Test
router.put(
  "/:id",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  updateMockTest
);

// Publish Mock Test
router.post(
  "/:id/publish",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  publishMockTest
);

// Unpublish Mock Test
router.patch(
  "/:id/unpublish",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  unpublishMockTest
);

// Disable Mock Test
router.patch(
  "/:id/disable",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  disableMockTest
);

module.exports = router;
