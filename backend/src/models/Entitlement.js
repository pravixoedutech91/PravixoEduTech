const mongoose = require("mongoose");

const entitlementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
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

    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
      index: true,
    },

    entitlementType: {
      type: String,
      enum: ["mock_test_pack"],
      default: "mock_test_pack",
      required: true,
      index: true,
    },

    mockTestIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MockTest",
      },
    ],

    validFrom: {
      type: Date,
      default: Date.now,
      required: true,
    },

    validUntil: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
      required: true,
      index: true,
    },

    revokedAt: {
      type: Date,
    },

    revokedReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

entitlementSchema.index(
  { tenantId: 1, studentId: 1, purchaseId: 1 },
  { unique: true }
);
entitlementSchema.index({ tenantId: 1, studentId: 1, status: 1, validUntil: 1 });
entitlementSchema.index({ tenantId: 1, mockTestIds: 1, status: 1 });

module.exports = mongoose.model("Entitlement", entitlementSchema);
