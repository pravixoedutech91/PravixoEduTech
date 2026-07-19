const mongoose = require("mongoose");

const referralSettingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
    },

    minimumWithdrawalAmountInPaise: {
      type: Number,
      default: 50000,
      min: 0,
    },

    rewardLockDays: {
      type: Number,
      default: 7,
      min: 0,
      max: 365,
    },

    refundSafetyDays: {
      type: Number,
      default: 7,
      min: 0,
      max: 365,
    },

    kycRequired: {
      type: Boolean,
      default: false,
    },

    upiRequired: {
      type: Boolean,
      default: true,
    },

    bankRequired: {
      type: Boolean,
      default: false,
    },

    maxWithdrawalAmountPerMonthInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },

    allowStudentPromoterWithdrawal: {
      type: Boolean,
      default: false,
    },

    manualApprovalRequired: {
      type: Boolean,
      default: true,
    },

    isReferralEnabled: {
      type: Boolean,
      default: false,
      index: true,
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

referralSettingsSchema.index({ tenantId: 1 }, { unique: true });

module.exports = mongoose.model("ReferralSettings", referralSettingsSchema);
