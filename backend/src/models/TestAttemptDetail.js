const mongoose = require("mongoose");

const answerDetailSchema = new mongoose.Schema(
  {
    sectionSlug: {
      type: String,
      required: true,
      trim: true,
    },

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },

    questionSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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

    questionOrder: {
      type: Number,
      default: 1,
      min: 1,
    },

    selectedOptionId: {
      type: String,
      enum: ["A", "B", "C", "D", "E"],
      default: null,
    },

    isCorrect: {
      type: Boolean,
      default: null,
    },

    marksAwarded: {
      type: Number,
      default: 0,
    },

    negativeMarksApplied: {
      type: Number,
      default: 0,
      min: 0,
    },

    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    confidenceLevel: {
      type: String,
      enum: ["not_marked", "sure", "doubtful", "guess"],
      default: "not_marked",
    },

    status: {
      type: String,
      enum: [
        "not_visited",
        "not_answered",
        "answered",
        "marked_for_review",
        "answered_and_marked",
      ],
      default: "not_visited",
    },

    visited: {
      type: Boolean,
      default: false,
    },

    markedForReview: {
      type: Boolean,
      default: false,
    },

    answeredAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const testAttemptDetailSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },

    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestAttempt",
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

    answers: {
      type: [answerDetailSchema],
      default: [],
    },

    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

testAttemptDetailSchema.index(
  { tenantId: 1, attemptId: 1 },
  { unique: true }
);

testAttemptDetailSchema.index({ tenantId: 1, studentId: 1, mockTestId: 1 });
testAttemptDetailSchema.index({ tenantId: 1, mockTestVersionId: 1 });

// MongoDB TTL index.
// Documents will expire only when expiresAt is set to a valid past Date.
testAttemptDetailSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("TestAttemptDetail", testAttemptDetailSchema);