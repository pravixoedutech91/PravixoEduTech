const express = require("express");
const router = express.Router();

const {
  getPublishedMockTestsForStudent,
  getActivePaymentPackagesForStudent,
  createPaymentPackageOrderForStudent,
  verifyPaymentPackagePaymentForStudent,
  getMyMockTestAttempts,
  startMockTestAttempt,
  saveMockTestAnswer,
  submitMockTestAttempt,
  getMockTestResult,
  getMockTestReview,

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

// Student: Get own mock test attempt history
router.get(
  "/mock-tests/my-attempts",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  getMyMockTestAttempts
);

// Student: Start or resume mock test attempt
router.post(
  "/mock-tests/:mockTestId/start",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  startMockTestAttempt
);

// Student: Save or update answer during attempt
router.patch(
  "/attempts/:attemptId/answer",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  saveMockTestAnswer
);

// Student: Submit mock test attempt
router.post(
  "/attempts/:attemptId/submit",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  submitMockTestAttempt
);

// Student: Get submitted attempt result
router.get(
  "/attempts/:attemptId/result",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  getMockTestResult
);

// Student: Get submitted attempt review
router.get(
  "/attempts/:attemptId/review",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  getMockTestReview
);



// Create Razorpay order for payment package
router.post(
  "/payment-packages/:productId/create-order",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  createPaymentPackageOrderForStudent
);


// Verify Razorpay payment and unlock payment package
router.post(
  "/payment-packages/verify-payment",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  verifyPaymentPackagePaymentForStudent
);

// Get active payment packages for student
router.get(
  "/payment-packages",
  protect,
  authorize("student"),
  checkFeatureAccess("mockTests"),
  getActivePaymentPackagesForStudent
);

module.exports = router;