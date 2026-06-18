const express = require("express");
const router = express.Router();

const {
  getPublishedMockTestsForStudent,
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

module.exports = router;