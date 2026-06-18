const express = require("express");
const router = express.Router();

const {
  getPublishedMockTestsForStudent,
  startMockTestAttempt,
} = require("../controllers/studentMockTestController");

const { protect, authorize } = require("../middleware/authMiddleware");

const { checkFeatureAccess } = require("../middleware/tenantMiddleware");

// Student: Get published mock tests
router.get(
  "/mock-tests",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  getPublishedMockTestsForStudent
);

// Student: Start or resume mock test attempt
router.post(
  "/mock-tests/:mockTestId/start",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  startMockTestAttempt
);

module.exports = router;