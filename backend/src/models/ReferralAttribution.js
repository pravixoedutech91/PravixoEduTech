const mongoose = require("mongoose");

const referralAttributionSchema = new mongoose.Schema(
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

    referralPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReferralPartner",
      required: true,
      index: true,
    },

    referralCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      index: true,
    },

    source: {
      type: String,
      enum: ["register", "checkout", "admin"],
      default: "register",
      required: true,
    },

    attributedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    lockedAt: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
      required: true,
      index: true,
    },

    cancelledAt: {
      type: Date,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
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

referralAttributionSchema.index(
  { tenantId: 1, studentId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "active",
    },
  }
);
referralAttributionSchema.index({
  tenantId: 1,
  referralPartnerId: 1,
  status: 1,
  createdAt: -1,
});
referralAttributionSchema.index({ tenantId: 1, referralCode: 1, status: 1 });

module.exports = mongoose.model(
  "ReferralAttribution",
  referralAttributionSchema
);
