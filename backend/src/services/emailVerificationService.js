const mongoose = require("mongoose");

const User = require("../models/User");

const EmailVerificationToken =
  require("../models/EmailVerificationToken");

const {
  generateEmailVerificationToken,
  isValidEmailVerificationTokenFormat,
  hashEmailVerificationToken,
  normalizeEmailForVerification,
  hashEmailVerificationAddress,
  getEmailVerificationExpiresAt,
} = require("../utils/emailVerificationSecurity");

const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS =
  2 * 60 * 1000;

const EMAIL_VERIFICATION_RESULT_CODES =
  Object.freeze({
    ISSUED: "ISSUED",
    COOLDOWN: "COOLDOWN",
    INELIGIBLE: "INELIGIBLE",
    VERIFIED: "VERIFIED",
    ALREADY_VERIFIED: "ALREADY_VERIFIED",
    INVALID_OR_EXPIRED_TOKEN:
      "INVALID_OR_EXPIRED_TOKEN",
  });

const isValidDate = (value) => {
  return (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  );
};

const ineligibleResult = () => ({
  success: false,
  code:
    EMAIL_VERIFICATION_RESULT_CODES
      .INELIGIBLE,
});

const cooldownResult = () => ({
  success: false,
  code:
    EMAIL_VERIFICATION_RESULT_CODES
      .COOLDOWN,
});

const invalidOrExpiredResult = () => ({
  success: false,
  code:
    EMAIL_VERIFICATION_RESULT_CODES
      .INVALID_OR_EXPIRED_TOKEN,
});

const normalizeVerificationLogin = (
  value
) => {
  if (typeof value !== "string") {
    return null;
  }

  const raw =
    value.trim();

  if (!raw) {
    return null;
  }

  if (raw.includes("@")) {
    const email =
      normalizeEmailForVerification(
        raw
      );

    if (!email) {
      return null;
    }

    return {
      type: "email",
      value: email,
    };
  }

  const mobile =
    raw.replace(/\D/g, "");

  if (!/^[0-9]{10}$/.test(mobile)) {
    return null;
  }

  return {
    type: "mobile",
    value: mobile,
  };
};

const buildEligibleStudentVerificationQuery = (
  login
) => {
  const normalized =
    normalizeVerificationLogin(
      login
    );

  if (!normalized) {
    return null;
  }

  const identityFilter =
    normalized.type === "email"
      ? {
          email:
            normalized.value,
        }
      : {
          mobile:
            normalized.value,
        };

  return {
    ...identityFilter,
    role: "student",
    isActive: true,
    isEmailVerified: {
      $ne: true,
    },
  };
};

const isDuplicateKeyForField = (
  error,
  field
) => {
  if (
    !error ||
    error.code !== 11000 ||
    typeof field !== "string" ||
    !field
  ) {
    return false;
  }

  if (
    error.keyPattern &&
    Object.prototype.hasOwnProperty.call(
      error.keyPattern,
      field
    )
  ) {
    return true;
  }

  if (
    error.keyValue &&
    Object.prototype.hasOwnProperty.call(
      error.keyValue,
      field
    )
  ) {
    return true;
  }

  return false;
};

const issueStudentEmailVerification = async ({
  user,
  deliverVerification,
  now = new Date(),
  enforceCooldown = false,
} = {}) => {
  if (
    typeof deliverVerification !==
      "function"
  ) {
    throw new TypeError(
      "An email-verification delivery function is required"
    );
  }

  if (!isValidDate(now)) {
    throw new TypeError(
      "A valid Date is required"
    );
  }

  if (
    !user ||
    typeof user !== "object" ||
    !user._id ||
    user.role !== "student" ||
    user.isActive !== true ||
    user.isEmailVerified === true
  ) {
    return ineligibleResult();
  }

  const tenantId =
    typeof user.tenantId === "string"
      ? user.tenantId
          .trim()
          .toLowerCase()
      : "";

  const normalizedEmail =
    normalizeEmailForVerification(
      user.email
    );

  if (
    !tenantId ||
    !normalizedEmail
  ) {
    return ineligibleResult();
  }

  const rawToken =
    generateEmailVerificationToken();

  const tokenHash =
    hashEmailVerificationToken(
      rawToken
    );

  const emailHash =
    hashEmailVerificationAddress(
      normalizedEmail
    );

  if (
    !tokenHash ||
    !emailHash
  ) {
    throw new Error(
      "Email verification credential generation failed"
    );
  }

  const expiresAt =
    getEmailVerificationExpiresAt(
      now
    );

  const cooldownCutoff =
    new Date(
      now.getTime() -
        EMAIL_VERIFICATION_RESEND_COOLDOWN_MS
    );

  const filter = {
    userId: user._id,
    tenantId,
  };

  if (enforceCooldown) {
    filter.$or = [
      {
        requestedAt: {
          $lte:
            cooldownCutoff,
        },
      },
      {
        requestedAt: {
          $exists: false,
        },
      },
    ];
  }

  const update = {
    $set: {
      tokenHash,
      emailHash,
      expiresAt,
      requestedAt: now,
      consumedAt: null,
    },

    $setOnInsert: {
      userId: user._id,
      tenantId,
    },
  };

  try {
    await EmailVerificationToken
      .findOneAndUpdate(
        filter,
        update,
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );
  } catch (error) {
    /*
     * Atomic cooldown:
     *
     * If a recent record already exists, the cooldown
     * filter does not match and the upsert races against
     * the unique userId index. Confirm that the existing
     * record really belongs to this tenant and is actually
     * still inside the cooldown window before converting
     * duplicate-key into the hidden COOLDOWN result.
     */
    if (
      enforceCooldown &&
      isDuplicateKeyForField(
        error,
        "userId"
      )
    ) {
      const existingRecord =
        await EmailVerificationToken
          .findOne({
            userId: user._id,
          })
          .select(
            "tenantId requestedAt"
          )
          .lean();

      const sameTenant =
        existingRecord &&
        String(
          existingRecord.tenantId ||
            ""
        )
          .trim()
          .toLowerCase() ===
          tenantId;

      const requestedAt =
        existingRecord &&
        existingRecord.requestedAt instanceof
          Date
          ? existingRecord.requestedAt
          : null;

      const stillCoolingDown =
        requestedAt &&
        requestedAt.getTime() >
          cooldownCutoff.getTime();

      if (
        sameTenant &&
        stillCoolingDown
      ) {
        return cooldownResult();
      }
    }

    throw error;
  }

  try {
    /*
     * rawToken crosses exactly one internal boundary:
     * the delivery callback.
     *
     * It is never returned from this service result and is
     * never stored in MongoDB.
     */
    await deliverVerification({
      toEmail:
        normalizedEmail,
      rawToken,
      expiresAt,
    });
  } catch (error) {
    /*
     * If delivery failed, remove only the exact credential
     * that this invocation created.
     *
     * A newer concurrent resend may already have rotated the
     * record. tokenHash in this cleanup filter prevents this
     * failure path from deleting that newer credential.
     */
    try {
      await EmailVerificationToken
        .deleteOne({
          userId: user._id,
          tenantId,
          tokenHash,
        });
    } catch {
      /*
       * Preserve the original delivery failure.
       * Cleanup failure must not replace it.
       */
    }

    throw error;
  }

  return {
    success: true,
    code:
      EMAIL_VERIFICATION_RESULT_CODES
        .ISSUED,
  };
};

const requestStudentEmailVerification = async ({
  login,
  deliverVerification,
  now = new Date(),
} = {}) => {
  if (
    typeof deliverVerification !==
      "function"
  ) {
    throw new TypeError(
      "An email-verification delivery function is required"
    );
  }

  if (!isValidDate(now)) {
    throw new TypeError(
      "A valid Date is required"
    );
  }

  const query =
    buildEligibleStudentVerificationQuery(
      login
    );

  if (!query) {
    return ineligibleResult();
  }

  const user =
    await User
      .findOne(query)
      .select(
        "_id tenantId role isActive isEmailVerified email"
      )
      .lean();

  if (!user) {
    return ineligibleResult();
  }

  return issueStudentEmailVerification({
    user,
    deliverVerification,
    now,
    enforceCooldown: true,
  });
};

const verifyStudentEmail = async ({
  rawToken,
  now = new Date(),
} = {}) => {
  if (!isValidDate(now)) {
    throw new TypeError(
      "A valid Date is required"
    );
  }

  if (
    !isValidEmailVerificationTokenFormat(
      rawToken
    )
  ) {
    return invalidOrExpiredResult();
  }

  const tokenHash =
    hashEmailVerificationToken(
      rawToken
    );

  if (!tokenHash) {
    return invalidOrExpiredResult();
  }

  const session =
    await mongoose.startSession();

  let result =
    invalidOrExpiredResult();

  try {
    await session.withTransaction(
      async () => {
        const verificationRecord =
          await EmailVerificationToken
            .findOne({
              tokenHash,
              consumedAt: null,
              expiresAt: {
                $gt: now,
              },
            })
            .select(
              "+emailHash"
            )
            .session(
              session
            );

        if (!verificationRecord) {
          return;
        }

        const user =
          await User
            .findOne({
              _id:
                verificationRecord.userId,
              tenantId:
                verificationRecord.tenantId,
              role: "student",
            })
            .session(
              session
            );

        if (
          !user ||
          user.isActive !== true
        ) {
          return;
        }

        const currentEmailHash =
          hashEmailVerificationAddress(
            user.email
          );

        if (
          !currentEmailHash ||
          currentEmailHash !==
            verificationRecord.emailHash
        ) {
          /*
           * The mailbox on User no longer matches the
           * mailbox for which this credential was issued.
           *
           * Leave the old token unconsumed but unusable.
           * A fresh resend will rotate it to the new current
           * email binding.
           */
          return;
        }

        /*
         * One-time credential consumption happens before
         * changing User state, inside the same transaction.
         *
         * If User.save fails, the transaction rolls the token
         * consumption back as well.
         */
        const consumedRecord =
          await EmailVerificationToken
            .findOneAndUpdate(
              {
                _id:
                  verificationRecord._id,
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
                returnDocument:
                  "after",
                session,
              }
            );

        if (!consumedRecord) {
          return;
        }

        /*
         * Password reset is already a trusted mailbox proof.
         * If another trusted path verified this user first,
         * consume this old verification token but do not
         * destroy a newer legitimate logged-in session.
         */
        if (
          user.isEmailVerified ===
            true
        ) {
          result = {
            success: true,
            code:
              EMAIL_VERIFICATION_RESULT_CODES
                .ALREADY_VERIFIED,
          };

          return;
        }

        user.isEmailVerified =
          true;

        /*
         * Verification itself never authenticates the user.
         * Clear any legacy pre-T-46 student session before
         * allowing the account to sign in normally.
         */
        user.activeSessionId =
          "";

        user.lastLoginDevice =
          "";

        await user.save({
          session,
        });

        result = {
          success: true,
          code:
            EMAIL_VERIFICATION_RESULT_CODES
              .VERIFIED,
        };
      }
    );
  } finally {
    await session.endSession();
  }

  return result;
};

module.exports = {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_RESULT_CODES,
  normalizeVerificationLogin,
  buildEligibleStudentVerificationQuery,
  issueStudentEmailVerification,
  requestStudentEmailVerification,
  verifyStudentEmail,
};
