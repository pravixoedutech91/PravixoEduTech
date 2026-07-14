const mongoose = require("mongoose");

const paymentProductSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1200,
    },

    productType: {
      type: String,
      enum: ["mock_test_pack"],
      default: "mock_test_pack",
      required: true,
      index: true,
    },

    priceInPaise: {
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

    includedMockTestIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MockTest",
      },
    ],

    validityDays: {
      type: Number,
      default: 365,
      min: 1,
      max: 3650,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

paymentProductSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
paymentProductSchema.index({ tenantId: 1, productType: 1, isActive: 1 });
paymentProductSchema.index({ tenantId: 1, sortOrder: 1, createdAt: -1 });

module.exports = mongoose.model("PaymentProduct", paymentProductSchema);
