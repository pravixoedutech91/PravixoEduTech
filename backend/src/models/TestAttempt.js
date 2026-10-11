const mongoose = require("mongoose");

const scoreSummarySchema = new mongoose.Schema(
  {
    totalQuestions: {
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

const sectionTimingWindowSchema = new mongoose.Schema(
  {
    sectionSlug: {
      type: String,
      required: true,
      trim: true,
    },

    order: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Section timing window order must be an integer",
      },
    },

    startsAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

sectionTimingWindowSchema.pre("validate", function () {
  if (
    this.startsAt &&
    this.expiresAt &&
    new Date(this.expiresAt).getTime() <=
      new Date(this.startsAt).getTime()
  ) {
    this.invalidate(
      "expiresAt",
      "Section timing window must expire after it starts"
    );
  }
});

const attemptTimingStateSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["global", "sectional"],
      required: true,
    },

    policyVersion: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Attempt timing policy version must be an integer",
      },
    },

    sectionWindows: {
      type: [sectionTimingWindowSchema],
      default: [],
    },
  },
  { _id: false }
);

attemptTimingStateSchema.pre("validate", function () {
  const windows =
    Array.isArray(this.sectionWindows)
      ? this.sectionWindows
      : [];

  if (this.mode === "global") {
    if (windows.length !== 0) {
      this.invalidate(
        "sectionWindows",
        "Global attempt timing state must not contain section windows"
      );
    }

    return;
  }

  if (this.mode !== "sectional") {
    return;
  }

  if (
    !Number.isInteger(this.policyVersion) ||
    this.policyVersion <= 0
  ) {
    this.invalidate(
      "policyVersion",
      "Sectional attempt timing requires a positive policy version"
    );
  }

  if (windows.length === 0) {
    this.invalidate(
      "sectionWindows",
      "Sectional attempt timing requires section windows"
    );

    return;
  }

  const slugs =
    windows.map((window) =>
      String(window.sectionSlug || "").trim()
    );

  if (new Set(slugs).size !== slugs.length) {
    this.invalidate(
      "sectionWindows",
      "Section timing window slugs must be unique"
    );
  }

  const orders =
    windows.map((window) =>
      Number(window.order)
    );

  if (new Set(orders).size !== orders.length) {
    this.invalidate(
      "sectionWindows",
      "Section timing window orders must be unique"
    );
  }

  const sorted =
    [...windows].sort(
      (a, b) =>
        Number(a.order) -
        Number(b.order)
    );

  for (
    let index = 1;
    index < sorted.length;
    index += 1
  ) {
    const previousExpiresAt =
      new Date(
        sorted[index - 1].expiresAt
      ).getTime();

    const currentStartsAt =
      new Date(
        sorted[index].startsAt
      ).getTime();

    if (
      Number.isFinite(previousExpiresAt) &&
      Number.isFinite(currentStartsAt) &&
      previousExpiresAt !== currentStartsAt
    ) {
      this.invalidate(
        "sectionWindows",
        "Section timing windows must be contiguous"
      );

      break;
    }
  }
});

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

    timingState: {
      type: attemptTimingStateSchema,
      default: undefined,
      immutable: true,
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

testAttemptSchema.pre("validate", function () {
  if (
    !this.timingState ||
    this.timingState.mode !== "sectional"
  ) {
    return;
  }

  const windows =
    Array.isArray(
      this.timingState.sectionWindows
    )
      ? [...this.timingState.sectionWindows].sort(
          (a, b) =>
            Number(a.order) -
            Number(b.order)
        )
      : [];

  if (windows.length === 0) {
    return;
  }

  const firstWindow =
    windows[0];

  const finalWindow =
    windows[
      windows.length - 1
    ];

  if (this.startedAt) {
    const attemptStartsAt =
      new Date(this.startedAt).getTime();

    const firstWindowStartsAt =
      new Date(
        firstWindow.startsAt
      ).getTime();

    if (
      Number.isFinite(attemptStartsAt) &&
      Number.isFinite(firstWindowStartsAt) &&
      attemptStartsAt !==
        firstWindowStartsAt
    ) {
      this.invalidate(
        "timingState",
        "Sectional timing schedule must start at attempt startedAt"
      );
    }
  }

  if (!this.expiresAt) {
    this.invalidate(
      "expiresAt",
      "Sectional timing requires attempt expiresAt"
    );

    return;
  }

  const attemptExpiresAt =
    new Date(
      this.expiresAt
    ).getTime();

  const finalWindowExpiresAt =
    new Date(
      finalWindow.expiresAt
    ).getTime();

  if (
    Number.isFinite(attemptExpiresAt) &&
    Number.isFinite(finalWindowExpiresAt) &&
    attemptExpiresAt !==
      finalWindowExpiresAt
  ) {
    this.invalidate(
      "timingState",
      "Sectional timing schedule must end at attempt expiresAt"
    );
  }
});

testAttemptSchema.index(
  { tenantId: 1, studentId: 1, mockTestId: 1, attemptNumber: 1 },
  { unique: true }
);

testAttemptSchema.index({ tenantId: 1, studentId: 1, status: 1 });
testAttemptSchema.index({ tenantId: 1, mockTestId: 1, status: 1 });
testAttemptSchema.index({ tenantId: 1, mockTestVersionId: 1 });
testAttemptSchema.index({ tenantId: 1, submittedAt: -1 });

module.exports = mongoose.model("TestAttempt", testAttemptSchema);