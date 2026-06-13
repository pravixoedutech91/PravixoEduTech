const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
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
  },
  { _id: false }
);

const examPatternSchema = new mongoose.Schema(
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

    examType: {
      type: String,
      enum: [
        "ssc",
        "railway",
        "banking",
        "upsc",
        "state_exam",
        "cpct",
        "custom",
      ],
      default: "custom",
    },

    totalDurationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    sections: {
      type: [sectionSchema],
      required: true,
      validate: {
        validator: function (sections) {
          return Array.isArray(sections) && sections.length > 0;
        },
        message: "At least one section is required.",
      },
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

examPatternSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true }
);

module.exports = mongoose.model("ExamPattern", examPatternSchema);