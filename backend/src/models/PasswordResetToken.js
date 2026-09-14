const mongoose = require("mongoose");

const RESET_TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/;

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      immutable: true,
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
      trim: true,
      lowercase: true,
      select: false,
      match: [
        RESET_TOKEN_HASH_PATTERN,
        "Password reset token hash must be a 64-character lowercase hex SHA-256 digest",
      ],
    },

    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
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
    collection: "password_reset_tokens",
  }
);

passwordResetTokenSchema.index({
  tenantId: 1,
  requestedAt: -1,
});

module.exports = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema
);
