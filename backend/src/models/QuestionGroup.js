const mongoose = require("mongoose");

const contentBlockSchema = new mongoose.Schema(
  {
    blockType: {
      type: String,
      enum: ["text", "instruction", "passage", "image", "table", "math"],
      required: true,
    },

    textEn: {
      type: String,
      trim: true,
      default: "",
    },

    textHi: {
      type: String,
      trim: true,
      default: "",
    },

    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },

    imagePublicId: {
      type: String,
      trim: true,
      default: "",
    },

    altText: {
      type: String,
      trim: true,
      default: "",
    },

    captionEn: {
      type: String,
      trim: true,
      default: "",
    },

    captionHi: {
      type: String,
      trim: true,
      default: "",
    },

    latex: {
      type: String,
      trim: true,
      default: "",
    },

    tableData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    order: {
      type: Number,
      default: 1,
      min: 1,
    },

    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const questionGroupSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    groupType: {
      type: String,
      enum: [
        "passage",
        "cloze",
        "reasoning_set",
        "di_set",
        "match_column",
        "instruction_set",
        "statement_set",
        "caselet",
        "science_diagram",
        "math_set",
        "other",
      ],
      required: true,
    },

    subject: {
      type: String,
      trim: true,
      default: "",
    },

    topic: {
      type: String,
      trim: true,
      default: "",
    },

    subTopic: {
      type: String,
      trim: true,
      default: "",
    },

    instructionEn: {
      type: String,
      trim: true,
      default: "",
    },

    instructionHi: {
      type: String,
      trim: true,
      default: "",
    },

    passageEn: {
      type: String,
      trim: true,
      default: "",
    },

    passageHi: {
      type: String,
      trim: true,
      default: "",
    },

    contentBlocks: {
      type: [contentBlockSchema],
      default: [],
    },

    displayMode: {
      type: String,
      enum: ["auto", "sticky", "split", "full_width", "collapsible"],
      default: "auto",
    },

    expectedQuestionCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    sourceType: {
      type: String,
      enum: ["original", "pyq", "imported"],
      default: "original",
    },

    pyqDetails: {
      examName: {
        type: String,
        trim: true,
        default: "",
      },

      year: {
        type: Number,
        default: null,
      },

      shift: {
        type: String,
        trim: true,
        default: "",
      },

      paperCode: {
        type: String,
        trim: true,
        default: "",
      },
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    tags: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

questionGroupSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
questionGroupSchema.index({ tenantId: 1, groupType: 1 });
questionGroupSchema.index({ tenantId: 1, subject: 1, topic: 1 });
questionGroupSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model("QuestionGroup", questionGroupSchema);