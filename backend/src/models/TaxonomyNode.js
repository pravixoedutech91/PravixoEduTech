const mongoose = require("mongoose");

const taxonomyNodeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      trim: true,
    },

    kind: {
      type: String,
      enum: ["subject", "topic", "subtopic"],
      required: true,
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaxonomyNode",
      default: null,
    },

    canonicalKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    nameEn: {
      type: String,
      default: "",
      trim: true,
    },

    nameHi: {
      type: String,
      default: "",
      trim: true,
    },

    aliasesEn: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },

    aliasesHi: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },

    descriptionEn: {
      type: String,
      default: "",
      trim: true,
    },

    descriptionHi: {
      type: String,
      default: "",
      trim: true,
    },

    order: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
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

taxonomyNodeSchema.pre("validate", function () {
  const hasEnglishName =
    typeof this.nameEn === "string" &&
    this.nameEn.trim().length > 0;

  const hasHindiName =
    typeof this.nameHi === "string" &&
    this.nameHi.trim().length > 0;

  if (!hasEnglishName && !hasHindiName) {
    this.invalidate(
      "nameEn",
      "At least one English or Hindi name is required."
    );
  }

  if (this.kind === "subject" && this.parentId) {
    this.invalidate(
      "parentId",
      "A subject cannot have a parent taxonomy node."
    );
  }

  if (
    ["topic", "subtopic"].includes(this.kind) &&
    !this.parentId
  ) {
    this.invalidate(
      "parentId",
      `${this.kind} requires a parent taxonomy node.`
    );
  }

  if (
    this.parentId &&
    this._id &&
    this.parentId.equals(this._id)
  ) {
    this.invalidate(
      "parentId",
      "A taxonomy node cannot be its own parent."
    );
  }
});

taxonomyNodeSchema.index(
  {
    tenantId: 1,
    canonicalKey: 1,
  },
  {
    unique: true,
  }
);

taxonomyNodeSchema.index(
  {
    tenantId: 1,
    kind: 1,
    parentId: 1,
    slug: 1,
  },
  {
    unique: true,
  }
);

taxonomyNodeSchema.index({
  tenantId: 1,
  kind: 1,
  parentId: 1,
  isActive: 1,
  order: 1,
});

module.exports = mongoose.model(
  "TaxonomyNode",
  taxonomyNodeSchema
);