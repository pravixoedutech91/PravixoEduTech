const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: "pravixoedutech",
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    icon: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

categorySchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true }
);

module.exports = mongoose.model("Category", categorySchema);