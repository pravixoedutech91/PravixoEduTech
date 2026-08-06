const express = require("express");

const {
    handleRazorpayWebhook,
} = require("../controllers/razorpayWebhookController");

const router = express.Router();

router.post("/", handleRazorpayWebhook);

module.exports = router;