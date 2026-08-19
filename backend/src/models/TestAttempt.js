const mongoose = require("mongoose");

const scoreSummarySchema = new mongoose.Schema(
  {
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    scorableQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    unscoredQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    attempted: {
      type: Number,
      default: 0,
      min: 0,
    },

    correct: {
      type: Number,
      default: 0,
      min: 0,
    },

    wrong: {
      type: Number,
      default: 0,
      min: 0,
    },

    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },

    score: {
      type: Number,
      default: 0,
    },

    maxScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const sectionSummarySchema = new mongoose.Schema(
  {
    sectionSlug: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      default: "",
      trim: true,
    },

    sectionType: {
      type: String,
      enum: ["mcq", "typing", "mixed"],
      default: "mcq",
    },

    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    scorableQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    unscoredQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    attempted: {
      type: Number,
      default: 0,
      min: 0,
    },

    correct: {
      type: Number,
      default: 0,
      min: 0,
    },

    wrong: {
      type: Number,
      default: 0,
      min: 0,
    },

    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },

    score: {
      type: Number,
      default: 0,
    },

    maxScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const topicSummarySchema = new mongoose.Schema(
  {
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

    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    scorableQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    unscoredQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    attempted: {
      type: Number,
      default: 0,
      min: 0,
    },

    correct: {
      type: Number,
      default: 0,
      min: 0,
    },

    wrong: {
      type: Number,
      default: 0,
      min: 0,
    },

    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },

    score: {
      type: Number,
      default: 0,
    },

    maxScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const difficultySummarySchema = new mongoose.Schema(
  {
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },

    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    scorableQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    unscoredQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    attempted: {
      type: Number,
      default: 0,
      min: 0,
    },

    correct: {
      type: Number,
      default: 0,
      min: 0,
    },

    wrong: {
      type: Number,
      default: 0,
      min: 0,
    },

    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },

    score: {
      type: Number,
      default: 0,
    },

    maxScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const rankSnapshotSchema = new mongoose.Schema(
  {
    allIndiaRank: {
      type: Number,
      default: null,
      min: 1,
    },

    tenantRank: {
      type: Number,
      default: null,
      min: 1,
    },

    stateRank: {
      type: Number,
      default: null,
      min: 1,
    },

    districtRank: {
      type: Number,
      default: null,
      min: 1,
    },

    batchRank: {
      type: Number,
      default: null,
      min: 1,
    },

    totalParticipants: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentile: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },

    calculatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    isDetailedReviewAvailable: {
      type: Boolean,
      default: false,
    },

    detailedReviewExpiresAt: {
      type: Date,
      default: null,
    },

    solutionVisibility: {
      type: String,
      enum: ["after_submit", "after_test_end", "never"],
      default: "after_submit",
    },

    reviewRetentionDays: {
      type: Number,
      default: 7,
      min: 1,
    },
  },
  { _id: false }
);

const testAttemptSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    mockTestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTest",
      required: true,
      index: true,
    },

    mockTestVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTestVersion",
      required: true,
      index: true,
    },

    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    accessTypeAtAttempt: {
      type: String,
      enum: ["free", "paid", "assigned"],
      default: "free",
    },

    status: {
      type: String,
      enum: ["in_progress", "submitted", "expired", "abandoned"],
      default: "in_progress",
      index: true,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    totalDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    scoreSummary: {
      type: scoreSummarySchema,
      default: () => ({}),
    },

    sectionSummaries: {
      type: [sectionSummarySchema],
      default: [],
    },

    topicSummaries: {
      type: [topicSummarySchema],
      default: [],
    },

    difficultySummaries: {
      type: [difficultySummarySchema],
      default: [],
    },

    rankSnapshot: {
      type: rankSnapshotSchema,
      default: () => ({}),
    },

    review: {
      type: reviewSchema,
      default: () => ({}),
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

testAttemptSchema.index(
  { tenantId: 1, studentId: 1, mockTestId: 1, attemptNumber: 1 },
  { unique: true }
);

testAttemptSchema.index({ tenantId: 1, studentId: 1, status: 1 });
testAttemptSchema.index({ tenantId: 1, mockTestId: 1, status: 1 });
testAttemptSchema.index({ tenantId: 1, mockTestVersionId: 1 });
testAttemptSchema.index({ tenantId: 1, submittedAt: -1 });

module.exports = mongoose.model("TestAttempt", testAttemptSchema);