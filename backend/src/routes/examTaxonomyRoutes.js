const express = require("express");
const router = express.Router();

const {
  getExamTaxonomyTree,
  createExamFamily,
  updateExamFamily,
  setExamFamilyStatus,
  createExam,
  updateExam,
  setExamStatus,
} = require("../controllers/examTaxonomyController");

const { protect, authorize } = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
  checkFeatureAccess,
} = require("../middleware/tenantMiddleware");

const adminRoles = ["super_admin", "tenant_admin", "content_admin"];

// Get managed Exam Family -> Exam taxonomy tree
router.get(
  "/",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  getExamTaxonomyTree
);

// Create Exam Family
router.post(
  "/families",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  createExamFamily
);

// Update Exam Family metadata
router.put(
  "/families/:familyId",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  updateExamFamily
);

// Activate / deactivate Exam Family
router.patch(
  "/families/:familyId/status",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  setExamFamilyStatus
);

// Create Exam under Exam Family
router.post(
  "/families/:familyId/exams",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  createExam
);

// Update Exam metadata
router.put(
  "/exams/:examId",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  updateExam
);

// Activate / deactivate Exam
router.patch(
  "/exams/:examId/status",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("mockTests"),
  ensureTenantAccess,
  setExamStatus
);

module.exports = router;