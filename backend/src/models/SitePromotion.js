const mongoose = require("mongoose");

const PROMOTION_PLACEMENTS = [
  "home_hero",
  "exams_hero",
  "study_notes_hero",
  "current_affairs_hero",
  "jobs_hero",
  "mock_tests_hero",
];

const PROMOTION_STATUSES = [
  "draft",
  "active",
  "inactive",
];

const sitePromotionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    placement: {
      type: String,
      required: true,
      enum: PROMOTION_PLACEMENTS,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    subtitle: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    badgeText: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },

    imageUrl: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    ctaLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },

    ctaUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: PROMOTION_STATUSES,
      default: "draft",
      required: true,
      index: true,
    },

    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
    },

    startAt: {
      type: Date,
      default: null,
    },

    endAt: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          if (!value || !this.startAt) {
            return true;
          }

          return value >= this.startAt;
        },
        message: "Promotion endAt must be on or after startAt",
      },
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

sitePromotionSchema.index({
  tenantId: 1,
  placement: 1,
  status: 1,
  priority: -1,
  updatedAt: -1,
});

sitePromotionSchema.index({
  tenantId: 1,
  status: 1,
  updatedAt: -1,
});

module.exports = mongoose.model(
  "SitePromotion",
  sitePromotionSchema
);
