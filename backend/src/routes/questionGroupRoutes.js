const express = require("express");
const router = express.Router();

const {
  createQuestionGroup,
  getAllQuestionGroups,
  getSingleQuestionGroup,
  updateQuestionGroup,
  disableQuestionGroup,
} = require("../controllers/questionGroupController");

const { protect, authorize } = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
  checkFeatureAccess,
} = require("../middleware/tenantMiddleware");

const adminRoles = ["super_admin", "tenant_admin", "content_admin"];

// Create Question Group
router.post(
  "/",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("questionGroups"),
  ensureTenantAccess,
  createQuestionGroup
);

// Get All Question Groups
router.get(
  "/",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("questionGroups"),
  getAllQuestionGroups
);

// Get Single Question Group
router.get(
  "/:id",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("questionGroups"),
  getSingleQuestionGroup
);

// Update Question Group
router.put(
  "/:id",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("questionGroups"),
  ensureTenantAccess,
  updateQuestionGroup
);

// Disable Question Group
router.patch(
  "/:id/disable",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("questionGroups"),
  ensureTenantAccess,
  disableQuestionGroup
);

module.exports = router;