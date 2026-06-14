const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      enum: ["A", "B", "C", "D", "E"],
      required: true,
    },

    textEn: {
      type: String,
      default: "",
      trim: true,
    },

    textHi: {
      type: String,
      default: "",
      trim: true,
    },

    imageUrl: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: "pravixoedutech",
      index: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    subject: {
      type: String,
      default: "",
      trim: true,
    },

    topic: {
      type: String,
      default: "",
      trim: true,
    },

    subTopic: {
      type: String,
      default: "",
      trim: true,
    },

    questionType: {
      type: String,
      enum: ["mcq", "typing"],
      default: "mcq",
    },

    sourceType: {
      type: String,
      enum: ["original", "pyq"],
      default: "original",
    },

    questionTextEn: {
      type: String,
      default: "",
      trim: true,
    },

    questionTextHi: {
      type: String,
      default: "",
      trim: true,
    },

    questionImageUrl: {
      type: String,
      default: "",
    },

    options: {
      type: [optionSchema],
      default: [],
    },

    correctOptionId: {
      type: String,
      enum: ["A", "B", "C", "D", "E"],
    },

    explanationEn: {
      type: String,
      default: "",
      trim: true,
    },

    explanationHi: {
      type: String,
      default: "",
      trim: true,
    },

    explanationImageUrl: {
      type: String,
      default: "",
    },

    marks: {
      type: Number,
      default: 1,
      min: 0,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    pyqDetails: {
      examName: {
        type: String,
        default: "",
        trim: true,
      },

      year: {
        type: Number,
      },

      shift: {
        type: String,
        default: "",
        trim: true,
      },

      paperCode: {
        type: String,
        default: "",
        trim: true,
      },
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
  { timestamps: true }
);

questionSchema.index({ tenantId: 1, isActive: 1 });
questionSchema.index({ tenantId: 1, categoryId: 1 });
questionSchema.index({ tenantId: 1, questionType: 1 });
questionSchema.index({ tenantId: 1, sourceType: 1 });
questionSchema.index({ tenantId: 1, difficulty: 1 });

module.exports = mongoose.model("Question", questionSchema);