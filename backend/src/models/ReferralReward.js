const mongoose = require("mongoose");

const referralRewardSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    referralPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReferralPartner",
      required: true,
      index: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
      index: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentProduct",
      required: true,
      index: true,
    },

    purchaseAmountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    rewardAmountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "withdrawal_requested",
        "paid",
        "reversed",
      ],
      default: "pending",
      required: true,
      index: true,
    },

    eligibleAt: {
      type: Date,
    },

    approvedAt: {
      type: Date,
    },

    rejectedAt: {
      type: Date,
    },

    withdrawalRequestedAt: {
      type: Date,
    },

    paidAt: {
      type: Date,
    },

    reversedAt: {
      type: Date,
    },

    adminNote: {
      type: String,
      trim: true,
      maxlength: 1000,
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

referralRewardSchema.index({ tenantId: 1, purchaseId: 1 }, { unique: true });
referralRewardSchema.index({
  tenantId: 1,
  referralPartnerId: 1,
  status: 1,
  createdAt: -1,
});
referralRewardSchema.index({ tenantId: 1, studentId: 1, status: 1 });
referralRewardSchema.index({ tenantId: 1, productId: 1, status: 1 });

module.exports = mongoose.model("ReferralReward", referralRewardSchema);
