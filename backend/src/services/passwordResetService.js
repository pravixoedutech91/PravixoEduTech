const mongoose = require("mongoose");

const User = require("../models/User");

const PasswordResetToken =
  require("../models/PasswordResetToken");

const {
  normalizePasswordRecoveryLogin,
  isValidPasswordResetTokenFormat,
  hashPasswordResetToken,
  createPasswordResetToken,
  getResetPasswordValidationError,
} = require("../utils/passwordResetSecurity");

const PASSWORD_RESET_REQUEST_COOLDOWN_MS =
  2 * 60 * 1000;

const RESET_PASSWORD_RESULT_CODES =
  Object.freeze({
    SUCCESS: "SUCCESS",
    INVALID_PASSWORD: "INVALID_PASSWORD",
    INVALID_OR_EXPIRED_TOKEN:
      "INVALID_OR_EXPIRED_TOKEN",
  });

const isValidDate = (value) => {
  return (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  );
};

const buildEligibleStudentRecoveryQuery = (
  login
) => {
  const normalizedLogin =
    normalizePasswordRecoveryLogin(login);

  if (!normalizedLogin) {
    return null;
  }

  if (normalizedLogin.includes("@")) {
    if (
      normalizedLogin.length > 254 ||
      normalizedLogin.includes(" ") ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedLogin
      )
    ) {
      return null;
    }

    return {
      email: normalizedLogin,
      role: "student",
      isActive: true,
    };
  }

  if (!/^[0-9]{10}$/.test(normalizedLogin)) {
    return null;
  }

  return {
    mobile: normalizedLogin,
    role: "student",
    isActive: true,
  };
};

const requestStudentPasswordReset = async ({
  login,
  deliverReset,
  now = new Date(),
} = {}) => {
  if (typeof deliverReset !== "function") {
    throw new TypeError(
      "A password-reset delivery function is required"
    );
  }

  if (!isValidDate(now)) {
    throw new TypeError(
      "A valid Date is required"
    );
  }

  const recoveryQuery =
    buildEligibleStudentRecoveryQuery(login);

  /*
   * Invalid identifiers deliberately behave the same
   * as unknown/ineligible accounts.
   */
  if (!recoveryQuery) {
    return;
  }

  const user =
    await User.findOne(
      recoveryQuery
    ).select(
      "_id tenantId email"
    );

  /*
   * Never disclose whether an account exists,
   * is inactive, or belongs to another role.
   */
  if (!user) {
    return;
  }

  const tenantId =
    String(user.tenantId || "")
      .trim()
      .toLowerCase();

  const toEmail =
    typeof user.email === "string"
      ? user.email.trim().toLowerCase()
      : "";

  if (
    !tenantId ||
    !toEmail ||
    toEmail.length > 254
  ) {
    return;
  }

  const {
    rawToken,
    tokenHash,
    expiresAt,
  } = createPasswordResetToken(now);

  const cooldownCutoff =
    new Date(
      now.getTime() -
        PASSWORD_RESET_REQUEST_COOLDOWN_MS
    );

  /*
   * The filter enforces the per-account cooldown
   * atomically.
   *
   * If another request has already refreshed the
   * same user's unique record inside the cooldown,
   * upsert attempts to insert another userId and
   * receives duplicate-key code 11000. That is
   * intentionally treated exactly like cooldown.
   */
  try {
    const resetRecord =
      await PasswordResetToken.findOneAndUpdate(
        {
          userId: user._id,

          $or: [
            {
              requestedAt: {
                $lte: cooldownCutoff,
              },
            },
            {
              requestedAt: {
                $exists: false,
              },
            },
          ],
        },
        {
          $set: {
            tokenHash,
            expiresAt,
            consumedAt: null,
            requestedAt: now,
          },

          $setOnInsert: {
            tenantId,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

    if (!resetRecord) {
      return;
    }
  } catch (error) {
    if (
      error &&
      error.code === 11000
    ) {
      return;
    }

    throw error;
  }

  /*
   * rawToken exists only in process memory and is
   * passed directly to the trusted delivery layer.
   * It is never returned from this service.
   */
  try {
    await deliverReset({
      toEmail,
      rawToken,
      expiresAt,
    });
  } catch (deliveryError) {
    /*
     * Revoke only the exact token whose delivery
     * failed. A newer concurrent reset token must
     * never be deleted accidentally.
     */
    try {
      await PasswordResetToken.deleteOne({
        userId: user._id,
        tokenHash,
        consumedAt: null,
      });
    } catch {
      /*
       * Cleanup failure must not replace the
       * original delivery failure.
       *
       * The undisclosed raw token still has
       * 256-bit entropy and expires automatically.
       */
    }

    throw deliveryError;
  }
};

const invalidOrExpiredResetResult = () => ({
  success: false,
  code:
    RESET_PASSWORD_RESULT_CODES
      .INVALID_OR_EXPIRED_TOKEN,
});

const resetStudentPassword = async ({
  rawToken,
  newPassword,
  now = new Date(),
} = {}) => {
  if (!isValidDate(now)) {
    throw new TypeError(
      "A valid Date is required"
    );
  }

  const passwordError =
    getResetPasswordValidationError(
      newPassword
    );

  if (passwordError) {
    return {
      success: false,
      code:
        RESET_PASSWORD_RESULT_CODES
          .INVALID_PASSWORD,
      message: passwordError,
    };
  }

  if (
    !isValidPasswordResetTokenFormat(
      rawToken
    )
  ) {
    return invalidOrExpiredResetResult();
  }

  const tokenHash =
    hashPasswordResetToken(rawToken);

  const session =
    await mongoose.startSession();

  let result =
    invalidOrExpiredResetResult();

  try {
    await session.withTransaction(
      async () => {
        /*
         * Claim token atomically inside the same
         * transaction as the password change.
         *
         * consumedAt:null prevents replay.
         * expiresAt:$gt ensures TTL cleanup timing
         * is never relied on for authorization.
         */
        const resetRecord =
          await PasswordResetToken
            .findOneAndUpdate(
              {
                tokenHash,
                consumedAt: null,
                expiresAt: {
                  $gt: now,
                },
              },
              {
                $set: {
                  consumedAt: now,
                },
              },
              {
                returnDocument: "after",
                session,
              }
            );

        if (!resetRecord) {
          result =
            invalidOrExpiredResetResult();
          return;
        }

        const user =
          await User.findOne({
            _id: resetRecord.userId,
            tenantId:
              resetRecord.tenantId,
            role: "student",
            isActive: true,
          }).session(session);

        /*
         * Burn a token whose user no longer exists,
         * changed tenant, became inactive, or is no
         * longer a student.
         */
        if (!user) {
          result =
            invalidOrExpiredResetResult();
          return;
        }

        /*
         * Assignment + save is deliberate.
         * User's existing pre-save hook performs
         * bcrypt hashing. Do not replace this with
         * a direct update query.
         */
        user.password =
          newPassword;

        /*
         * Invalidate every previously issued
         * student JWT/session immediately.
         */
        user.activeSessionId = "";
        user.lastLoginDevice = "";

        /*
         * T-45 reset tokens are delivered only to
         * the account's stored email address.
         * Successful token possession therefore
         * verifies control of that mailbox.
         */
        user.isEmailVerified = true;

        await user.save({
          session,
        });

        result = {
          success: true,
          code:
            RESET_PASSWORD_RESULT_CODES
              .SUCCESS,
        };
      }
    );
  } finally {
    await session.endSession();
  }

  return result;
};

module.exports = {
  PASSWORD_RESET_REQUEST_COOLDOWN_MS,
  RESET_PASSWORD_RESULT_CODES,
  buildEligibleStudentRecoveryQuery,
  requestStudentPasswordReset,
  resetStudentPassword,
};
