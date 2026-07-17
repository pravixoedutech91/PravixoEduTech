const mongoose = require("mongoose");

const bankDetailsSnapshotSchema = new mongoose.Schema(
  {
    accountHolderName: {
      type: String,
      trim: true,
      maxlength: 160,
    },

    accountNumberLast4: {
      type: String,
      trim: true,
      maxlength: 4,
    },

    ifsc: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },

    bankName: {
      type: String,
      trim: true,
      maxlength: 160,
    },
  },
  {
    _id: false,
  }
);

const withdrawalRequestSchema = new mongoose.Schema(
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

    amountInPaise: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: ["requested", "approved", "rejected", "paid", "cancelled"],
      default: "requested",
      required: true,
      index: true,
    },

    payoutMethod: {
      type: String,
      enum: ["upi", "bank", "cash", "other"],
      default: "upi",
      required: true,
    },

    upiId: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },

    bankDetailsSnapshot: bankDetailsSnapshotSchema,

    requestedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    approvedAt: {
      type: Date,
    },

    rejectedAt: {
      type: Date,
    },

    paidAt: {
      type: Date,
    },

    cancelledAt: {
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

withdrawalRequestSchema.index({
  tenantId: 1,
  referralPartnerId: 1,
  status: 1,
  createdAt: -1,
});
withdrawalRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
