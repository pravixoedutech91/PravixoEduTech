const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    logo: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    plan: {
     type: String,
     default: "custom",
    }, 
    features: {
      articles: {
        type: Boolean,
        default: true,
      },

      notifications: {
        type: Boolean,
        default: true,
      },

      currentAffairs: {
        type: Boolean,
        default: true,
      },

      studyNotes: {
        type: Boolean,
        default: true,
      },

      mockTests: {
        type: Boolean,
        default: false,
      },

      lms: {
        type: Boolean,
        default: false,
      },

      referrals: {
        type: Boolean,
        default: false,
      },

      analytics: {
        type: Boolean,
        default: false,
      },
           
    },
limits: {
  maxCourses: {
    type: Number,
    default: 0,
  },

  maxTests: {
    type: Number,
    default: 0,
  },

  maxStudents: {
    type: Number,
    default: 0,
  },

  maxStorageMB: {
    type: Number,
    default: 0,
  },
},

  },
  {
    timestamps: true,
  }
);



module.exports = mongoose.model("Tenant", tenantSchema);