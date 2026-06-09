const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    tenantId: {
  type: String,
  default: "pravixoedutech",
  index: true,
},

    type: {
      type: String,
      enum: [
        "article",
        "study_note",
        "notification",
        "current_affairs",
      ],
      required: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    summary: {
      type: String,
      default: "",
    },

    content: {
      type: String,
      required: true,
    },

    featuredImage: {
      type: String,
      default: "",
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    seoTitle: {
      type: String,
      default: "",
    },

    seoDescription: {
      type: String,
      default: "",
    },

    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

contentSchema.index({ tenantId: 1, type: 1 });
contentSchema.index({ tenantId: 1, slug: 1 });
contentSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model("Content", contentSchema);