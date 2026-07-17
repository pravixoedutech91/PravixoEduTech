const mongoose = require("mongoose");

const referralPartnerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    mobile: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{10}$/, "Mobile number must be exactly 10 digits"],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },

    promoterType: {
      type: String,
      enum: [
        "library",
        "cyber_cafe",
        "coaching",
        "teacher",
        "student",
        "influencer",
        "partner",
        "other",
      ],
      default: "other",
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    status: {
      type: String,
      enum: ["pending", "active", "suspended", "rejected"],
      default: "pending",
      required: true,
      index: true,
    },

    commissionType: {
      type: String,
      enum: ["flat", "percentage"],
      default: "flat",
      required: true,
    },

    commissionValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    walletBalanceInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalEarnedInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalWithdrawnInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },

    notes: {
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

referralPartnerSchema.index({ tenantId: 1, code: 1 }, { unique: true });
referralPartnerSchema.index({ tenantId: 1, mobile: 1 }, { unique: true });
referralPartnerSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
referralPartnerSchema.index({ tenantId: 1, promoterType: 1, status: 1 });

module.exports = mongoose.model("ReferralPartner", referralPartnerSchema);
