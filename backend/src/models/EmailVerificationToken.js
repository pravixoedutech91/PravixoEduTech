const mongoose = require("mongoose");

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

const emailVerificationTokenSchema =
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        immutable: true,
        index: true,
      },

      tenantId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        immutable: true,
        index: true,
      },

      tokenHash: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        select: false,
        match: SHA256_HEX_PATTERN,
      },

      /*
       * Bind this verification credential to the exact
       * normalized email address for which it was issued.
       *
       * Store only SHA-256(email), never another plaintext
       * copy of the student's email in this collection.
       */
      emailHash: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        select: false,
        match: SHA256_HEX_PATTERN,
      },

      expiresAt: {
        type: Date,
        required: true,
      },

      consumedAt: {
        type: Date,
        default: null,
      },

      requestedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
    },
    {
      timestamps: true,
      strict: "throw",
      collection:
        "email_verification_tokens",
    }
  );

/*
 * MongoDB TTL cleanup is not an authorization boundary.
 * Verification logic must independently reject expired
 * credentials before changing User state.
 */
emailVerificationTokenSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

module.exports =
  mongoose.model(
    "EmailVerificationToken",
    emailVerificationTokenSchema
  );
