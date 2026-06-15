const mongoose = require("mongoose");

const mockTestQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },

    order: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false }
);

const mockTestSectionSchema = new mongoose.Schema(
  {
    sectionSlug: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    sectionType: {
      type: String,
      enum: ["mcq", "typing", "mixed"],
      default: "mcq",
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 0,
    },

    questionCount: {
      type: Number,
      required: true,
      min: 1,
    },

    marksPerQuestion: {
      type: Number,
      required: true,
      min: 0,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },

    questions: {
      type: [mockTestQuestionSchema],
      default: [],
    },
  },
  { _id: false }
);

const mockTestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      default: "pravixoedutech",
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
      default: "",
      trim: true,
    },

    testType: {
      type: String,
      enum: ["mock", "pyq", "practice"],
      default: "mock",
    },

    examPatternId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamPattern",
      required: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    accessType: {
      type: String,
      enum: ["free", "paid", "assigned"],
      default: "free",
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    salePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    isPurchasable: {
      type: Boolean,
      default: true,
    },

    instructionsEn: {
      type: String,
      default: "",
      trim: true,
    },

    instructionsHi: {
      type: String,
      default: "",
      trim: true,
    },

    sections: {
      type: [mockTestSectionSchema],
      default: [],
    },

    settings: {
      maxAttempts: {
        type: Number,
        default: 1,
        min: 1,
      },

      showResultImmediately: {
        type: Boolean,
        default: true,
      },

      solutionVisibility: {
        type: String,
        enum: ["after_submit", "after_test_end", "never"],
        default: "after_submit",
      },

      allowResume: {
        type: Boolean,
        default: true,
      },

      allowQuestionNavigation: {
        type: Boolean,
        default: true,
      },

      allowSectionSwitching: {
        type: Boolean,
        default: true,
      },

      allowLanguageSwitching: {
        type: Boolean,
        default: true,
      },

      shuffleQuestions: {
        type: Boolean,
        default: false,
      },

      shuffleOptions: {
        type: Boolean,
        default: false,
      },

      rankEnabled: {
        type: Boolean,
        default: false,
      },

      batchRankEnabled: {
        type: Boolean,
        default: false,
      },

      platformRankEnabled: {
        type: Boolean,
        default: false,
      },

      questionFeedbackEnabled: {
        type: Boolean,
        default: true,
      },

      showTopicWiseAnalysis: {
        type: Boolean,
        default: true,
      },

      showDifficultyAnalysis: {
        type: Boolean,
        default: true,
      },

      showTimeAnalysis: {
        type: Boolean,
        default: true,
      },

      interfaceMode: {
        type: String,
        enum: ["default", "ssc", "banking", "railway", "cpct"],
        default: "default",
      },
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    activeVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTestVersion",
    },

    publishedAt: {
      type: Date,
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

mockTestSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
mockTestSchema.index({ tenantId: 1, testType: 1 });
mockTestSchema.index({ tenantId: 1, accessType: 1 });
mockTestSchema.index({ tenantId: 1, isPublished: 1 });
mockTestSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model("MockTest", mockTestSchema);