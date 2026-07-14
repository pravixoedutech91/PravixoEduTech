const mongoose = require("mongoose");

const purchaseProductSnapshotSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },

    slug: {
      type: String,
      trim: true,
    },

    productType: {
      type: String,
      enum: ["mock_test_pack"],
      default: "mock_test_pack",
    },

    includedMockTestIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MockTest",
      },
    ],

    validityDays: {
      type: Number,
      default: 365,
    },
  },
  {
    _id: false,
  }
);

const purchaseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentProduct",
      required: true,
      index: true,
    },

    productSnapshot: purchaseProductSnapshotSchema,

    amountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    status: {
      type: String,
      enum: ["created", "paid", "failed", "cancelled", "refunded"],
      default: "created",
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
      required: true,
    },

    receipt: {
      type: String,
      trim: true,
      maxlength: 80,
    },

    razorpayOrderId: {
      type: String,
      trim: true,
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
    },

    razorpaySignature: {
      type: String,
      trim: true,
    },

    paidAt: {
      type: Date,
    },

    failedAt: {
      type: Date,
    },

    cancelledAt: {
      type: Date,
    },

    refundedAt: {
      type: Date,
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

purchaseSchema.index({ tenantId: 1, studentId: 1, status: 1, createdAt: -1 });
purchaseSchema.index({ tenantId: 1, productId: 1, status: 1 });
purchaseSchema.index(
  { tenantId: 1, razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayOrderId: { $exists: true, $type: "string" },
    },
  }
);
purchaseSchema.index(
  { tenantId: 1, razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $exists: true, $type: "string" },
    },
  }
);

module.exports = mongoose.model("Purchase", purchaseSchema);
