const mongoose = require("mongoose");

const optionSnapshotSchema = new mongoose.Schema(
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

const contentBlockSnapshotSchema = new mongoose.Schema(
  {
    blockType: {
      type: String,
      enum: ["text", "instruction", "passage", "image", "table", "math"],
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

    imagePublicId: {
      type: String,
      default: "",
    },

    altText: {
      type: String,
      default: "",
      trim: true,
    },

    captionEn: {
      type: String,
      default: "",
      trim: true,
    },

    captionHi: {
      type: String,
      default: "",
      trim: true,
    },

    latex: {
      type: String,
      default: "",
      trim: true,
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

const questionGroupSnapshotSchema = new mongoose.Schema(
  {
    questionGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionGroup",
    },

    title: {
      type: String,
      default: "",
      trim: true,
    },

    slug: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
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
      default: "instruction_set",
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

    instructionEn: {
      type: String,
      default: "",
      trim: true,
    },

    instructionHi: {
      type: String,
      default: "",
      trim: true,
    },

    passageEn: {
      type: String,
      default: "",
      trim: true,
    },

    passageHi: {
      type: String,
      default: "",
      trim: true,
    },

    contentBlocks: {
      type: [contentBlockSnapshotSchema],
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
        default: "",
        trim: true,
      },

      year: {
        type: Number,
        default: null,
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
  },
  { _id: false }
);

const questionSnapshotSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
    },

    questionGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionGroup",
      default: null,
    },

    groupQuestionOrder: {
      type: Number,
      default: null,
      min: 1,
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

    evaluationStatus: {
      type: String,
      enum: ["scored", "officially_cancelled", "source_ambiguous"],
      default: "scored",
    },

    evaluationNoteEn: {
      type: String,
      default: "",
      trim: true,
    },

    evaluationNoteHi: {
      type: String,
      default: "",
      trim: true,
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
      type: [optionSnapshotSchema],
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

    order: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: true }
);

const sectionSnapshotSchema = new mongoose.Schema(
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

    questionGroups: {
      type: [questionGroupSnapshotSchema],
      default: [],
    },

    questions: {
      type: [questionSnapshotSchema],
      default: [],
    },
  },
  { _id: false }
);

const examPatternSnapshotSchema = new mongoose.Schema(
  {
    examPatternId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamPattern",
    },

    name: {
      type: String,
      default: "",
      trim: true,
    },

    examType: {
      type: String,
      default: "custom",
      trim: true,
    },

    totalDurationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    allowSectionSwitching: {
      type: Boolean,
      default: true,
    },

    allowQuestionNavigation: {
      type: Boolean,
      default: true,
    },

    allowLanguageSwitching: {
      type: Boolean,
      default: true,
    },

    showResultImmediately: {
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
  },
  { _id: false }
);

const mockTestVersionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    mockTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTest",
      required: true,
      index: true,
    },

    versionNumber: {
      type: Number,
      required: true,
      min: 1,
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

    examPatternSnapshot: {
      type: examPatternSnapshotSchema,
      required: true,
    },

    sections: {
      type: [sectionSnapshotSchema],
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

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    publishedAt: {
      type: Date,
      default: Date.now,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

mockTestVersionSchema.index(
  { tenantId: 1, mockTestId: 1, versionNumber: 1 },
  { unique: true }
);

mockTestVersionSchema.index({ tenantId: 1, testType: 1 });
mockTestVersionSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model("MockTestVersion", mockTestVersionSchema);