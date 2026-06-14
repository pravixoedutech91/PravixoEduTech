const express = require("express");
const router = express.Router();

const {
  createQuestion,
  getAllQuestions,
  updateQuestion,
  disableQuestion,
} = require("../controllers/questionController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
  checkFeatureAccess,
} = require("../middleware/tenantMiddleware");

// Create Question
router.post(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  createQuestion
);

// Get All Questions
router.get(
  "/",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  getAllQuestions
);

// Update Question
router.put(
  "/:id",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  updateQuestion
);

// Disable Question
router.patch(
  "/:id/disable",
  protect,
  authorize("super_admin", "tenant_admin", "content_admin"),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  disableQuestion
);

module.exports = router;