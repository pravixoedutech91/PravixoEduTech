const express = require("express");
const router = express.Router();

const {
  createExamPattern,
  getAllExamPatterns,
  updateExamPattern,
  disableExamPattern,
  deleteExamPattern,
} = require("../controllers/examPatternController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
  checkFeatureAccess,
} = require("../middleware/tenantMiddleware");

// Create Exam Pattern
router.post(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  createExamPattern
);

// Get All Exam Patterns
router.get(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  getAllExamPatterns
);

// Update Exam Pattern
router.put(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  updateExamPattern
);

// Disable Exam Pattern
router.patch(
  "/:id/disable",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  disableExamPattern
);

router.delete(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  deleteExamPattern
);

module.exports = router;