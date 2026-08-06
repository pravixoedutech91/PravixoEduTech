const mongoose = require("mongoose");

const razorpayWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    status: {
      type: String,
      enum: ["processed", "ignored"],
      required: true,
      index: true,
    },

    tenantId: {
      type: String,
      trim: true,
      index: true,
    },

    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      index: true,
    },

    razorpayOrderId: {
      type: String,
      trim: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
      index: true,
    },

    payloadCreatedAt: {
      type: Date,
    },

    processedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

razorpayWebhookEventSchema.index(
  {
    eventId: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "RazorpayWebhookEvent",
  razorpayWebhookEventSchema
);