const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");

const User = require("../src/models/User");

const PasswordResetToken =
  require("../src/models/PasswordResetToken");

const {
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TOKEN_TTL_MS,
  MIN_PASSWORD_CHARACTERS,
  MAX_PASSWORD_UTF8_BYTES,
  normalizePasswordRecoveryLogin,
  isValidPasswordResetTokenFormat,
  hashPasswordResetToken,
  createPasswordResetToken,
  getResetPasswordValidationError,
} = require("../src/utils/passwordResetSecurity");

const {
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS,
  RESET_PASSWORD_RATE_LIMIT_MAX_FAILURES,
  getPasswordResetRateLimitKey,
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
} = require("../src/middleware/passwordResetRateLimitMiddleware");

const {
  PASSWORD_RESET_REQUEST_COOLDOWN_MS,
  RESET_PASSWORD_RESULT_CODES,
  buildEligibleStudentRecoveryQuery,
  requestStudentPasswordReset,
  resetStudentPassword,
} = require("../src/services/passwordResetService");

const fixedNow =
  new Date("2026-09-05T12:00:00.000Z");

const fakeUserId =
  "507f1f77bcf86cd799439011";

const readBackendSource = (relativePath) => {
  return fs.readFileSync(
    path.join(
      __dirname,
      "..",
      relativePath
    ),
    "utf8"
  );
};

const startRateLimitTestServer = async () => {
  const app = express();

  app.post(
    "/forgot",
    forgotPasswordRateLimiter,
    (req, res) => {
      res.status(200).json({
        success: true,
      });
    }
  );

  app.post(
    "/reset-fail",
    resetPasswordRateLimiter,
    (req, res) => {
      res.status(400).json({
        success: false,
      });
    }
  );

  app.post(
    "/reset-success",
    resetPasswordRateLimiter,
    (req, res) => {
      res.status(200).json({
        success: true,
      });
    }
  );

  app.post(
    "/reset-server-error",
    resetPasswordRateLimiter,
    (req, res) => {
      res.status(500).json({
        success: false,
      });
    }
  );

  return await new Promise(
    (resolve, reject) => {
      const server =
        app.listen(
          0,
          "127.0.0.1",
          () => resolve(server)
        );

      server.on(
        "error",
        reject
      );
    }
  );
};

const stopServer = async (server) => {
  await new Promise(
    (resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }
  );
};

test(
  "password reset token model stores only hashed token state",
  () => {
    const schema =
      PasswordResetToken.schema;

    assert.equal(
      schema.options.strict,
      "throw"
    );

    assert.equal(
      PasswordResetToken
        .collection
        .collectionName,
      "password_reset_tokens"
    );

    const userId =
      schema.path("userId");

    const tenantId =
      schema.path("tenantId");

    const tokenHash =
      schema.path("tokenHash");

    const expiresAt =
      schema.path("expiresAt");

    assert.equal(
      userId.options.required,
      true
    );

    assert.equal(
      userId.options.unique,
      true
    );

    assert.equal(
      userId.options.immutable,
      true
    );

    assert.equal(
      tenantId.options.required,
      true
    );

    assert.equal(
      tenantId.options.immutable,
      true
    );

    assert.equal(
      tokenHash.options.required,
      true
    );

    assert.equal(
      tokenHash.options.unique,
      true
    );

    assert.equal(
      tokenHash.options.select,
      false
    );

    assert.equal(
      expiresAt.options.required,
      true
    );

    const forbiddenFields = [
      "rawToken",
      "token",
      "password",
      "email",
      "mobile",
    ];

    for (const field of forbiddenFields) {
      assert.equal(
        schema.path(field),
        undefined
      );
    }

    const indexes =
      schema.indexes();

    assert.equal(
      indexes.some(
        ([keys, options]) =>
          keys.userId === 1 &&
          options.unique === true
      ),
      true
    );

    assert.equal(
      indexes.some(
        ([keys, options]) =>
          keys.tokenHash === 1 &&
          options.unique === true
      ),
      true
    );

    assert.equal(
      indexes.some(
        ([keys, options]) =>
          keys.expiresAt === 1 &&
          Number(
            options.expireAfterSeconds
          ) === 0
      ),
      true
    );
  }
);

test(
  "password reset tokens use 256-bit entropy and SHA-256-only persistence",
  () => {
    assert.equal(
      PASSWORD_RESET_TOKEN_BYTES,
      32
    );

    assert.equal(
      PASSWORD_RESET_TOKEN_BYTES * 8,
      256
    );

    const first =
      createPasswordResetToken(
        fixedNow
      );

    const second =
      createPasswordResetToken(
        fixedNow
      );

    assert.equal(
      first.rawToken.length,
      43
    );

    assert.equal(
      isValidPasswordResetTokenFormat(
        first.rawToken
      ),
      true
    );

    assert.match(
      first.tokenHash,
      /^[a-f0-9]{64}$/
    );

    assert.notEqual(
      first.rawToken,
      first.tokenHash
    );

    assert.notEqual(
      first.rawToken,
      second.rawToken
    );

    assert.notEqual(
      first.tokenHash,
      second.tokenHash
    );

    const independentHash =
      crypto
        .createHash("sha256")
        .update(
          first.rawToken,
          "utf8"
        )
        .digest("hex");

    assert.equal(
      first.tokenHash,
      independentHash
    );

    assert.equal(
      hashPasswordResetToken(
        first.rawToken
      ),
      first.tokenHash
    );
  }
);

test(
  "password reset token expires after exactly 15 minutes",
  () => {
    assert.equal(
      PASSWORD_RESET_TOKEN_TTL_MS,
      15 * 60 * 1000
    );

    const generated =
      createPasswordResetToken(
        fixedNow
      );

    assert.equal(
      generated
        .expiresAt
        .toISOString(),
      "2026-09-05T12:15:00.000Z"
    );

    assert.equal(
      generated.expiresAt.getTime() -
        fixedNow.getTime(),
      15 * 60 * 1000
    );
  }
);

test(
  "malformed reset tokens are rejected before hashing",
  () => {
    const invalidTokens = [
      "",
      "abc",
      "A".repeat(42),
      "A".repeat(44),
      "a".repeat(42) + "=",
      "contains space",
      null,
      undefined,
    ];

    for (const token of invalidTokens) {
      assert.equal(
        isValidPasswordResetTokenFormat(
          token
        ),
        false
      );

      assert.throws(
        () =>
          hashPasswordResetToken(
            token
          ),
        {
          name: "TypeError",
        }
      );
    }
  }
);

test(
  "password recovery identity follows login normalization without stripping country code",
  () => {
    assert.equal(
      normalizePasswordRecoveryLogin(
        "  SWASTIK@GMAIL.COM  "
      ),
      "swastik@gmail.com"
    );

    assert.equal(
      normalizePasswordRecoveryLogin(
        "99988-84444"
      ),
      "9998884444"
    );

    assert.equal(
      normalizePasswordRecoveryLogin(
        "+91 99988-84444"
      ),
      "919998884444"
    );

    assert.deepEqual(
      buildEligibleStudentRecoveryQuery(
        "  SWASTIK@GMAIL.COM  "
      ),
      {
        email:
          "swastik@gmail.com",
        role:
          "student",
        isActive:
          true,
      }
    );

    assert.deepEqual(
      buildEligibleStudentRecoveryQuery(
        "99988-84444"
      ),
      {
        mobile:
          "9998884444",
        role:
          "student",
        isActive:
          true,
      }
    );

    assert.equal(
      buildEligibleStudentRecoveryQuery(
        "+91 99988-84444"
      ),
      null
    );

    assert.deepEqual(
      buildEligibleStudentRecoveryQuery(
        "student@example.com"
      ),
      {
        email:
          "student@example.com",
        role:
          "student",
        isActive:
          true,
      }
    );
  }
);

test(
  "reset password enforces 8 characters and 72 UTF-8 byte bcrypt boundary",
  () => {
    assert.equal(
      MIN_PASSWORD_CHARACTERS,
      8
    );

    assert.equal(
      MAX_PASSWORD_UTF8_BYTES,
      72
    );

    assert.equal(
      getResetPasswordValidationError(
        "1234567"
      ),
      "Password must be at least 8 characters"
    );

    assert.equal(
      getResetPasswordValidationError(
        "12345678"
      ),
      null
    );

    assert.equal(
      Buffer.byteLength(
        "\u00e9".repeat(36),
        "utf8"
      ),
      72
    );

    assert.equal(
      getResetPasswordValidationError(
        "\u00e9".repeat(36)
      ),
      null
    );

    assert.equal(
      getResetPasswordValidationError(
        "\u00e9".repeat(37)
      ),
      "Password must not exceed 72 UTF-8 bytes"
    );
  }
);

test(
  "password recovery limiters preserve independent abuse budgets",
  async () => {
    assert.equal(
      PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    );

    assert.equal(
      FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS,
      5
    );

    assert.equal(
      RESET_PASSWORD_RATE_LIMIT_MAX_FAILURES,
      10
    );

    const key =
      getPasswordResetRateLimitKey({
        ip: "127.0.0.1",
        headers: {},
        socket: {
          remoteAddress:
            "127.0.0.1",
        },
      });

    assert.equal(
      typeof key,
      "string"
    );

    assert.ok(
      key.length > 0
    );

    const server =
      await startRateLimitTestServer();

    try {
      const address =
        server.address();

      const baseUrl =
        "http://127.0.0.1:" +
        address.port;

      for (
        let i = 0;
        i < 5;
        i += 1
      ) {
        const response =
          await fetch(
            baseUrl + "/forgot",
            {
              method: "POST",
            }
          );

        assert.equal(
          response.status,
          200
        );
      }

      const blockedForgot =
        await fetch(
          baseUrl + "/forgot",
          {
            method: "POST",
          }
        );

      assert.equal(
        blockedForgot.status,
        429
      );

      for (
        let i = 0;
        i < 3;
        i += 1
      ) {
        const response =
          await fetch(
            baseUrl +
              "/reset-success",
            {
              method: "POST",
            }
          );

        assert.equal(
          response.status,
          200
        );
      }

      for (
        let i = 0;
        i < 2;
        i += 1
      ) {
        const response =
          await fetch(
            baseUrl +
              "/reset-server-error",
            {
              method: "POST",
            }
          );

        assert.equal(
          response.status,
          500
        );
      }

      for (
        let i = 0;
        i < 10;
        i += 1
      ) {
        const response =
          await fetch(
            baseUrl +
              "/reset-fail",
            {
              method: "POST",
            }
          );

        assert.equal(
          response.status,
          400
        );
      }

      const blockedReset =
        await fetch(
          baseUrl +
            "/reset-fail",
          {
            method: "POST",
          }
        );

      assert.equal(
        blockedReset.status,
        429
      );
    } finally {
      await stopServer(server);
    }
  }
);

test(
  "reset request creates one hashed token and exposes raw token only to delivery callback",
  { concurrency: false },
  async () => {
    const originalUserFindOne =
      User.findOne;

    const originalTokenUpdate =
      PasswordResetToken
        .findOneAndUpdate;

    try {
      let tokenFilter;
      let tokenUpdate;
      let tokenOptions;
      let deliveredPayload;

      User.findOne = (query) => {
        assert.deepEqual(
          query,
          {
            email:
              "student@example.com",
            role:
              "student",
            isActive:
              true,
          }
        );

        return {
          select:
            async (projection) => {
              assert.equal(
                projection,
                "_id tenantId email"
              );

              return {
                _id:
                  fakeUserId,
                tenantId:
                  "pravixoedutech",
                email:
                  "student@example.com",
              };
            },
        };
      };

      PasswordResetToken.findOneAndUpdate =
        async (
          filter,
          update,
          options
        ) => {
          tokenFilter =
            filter;

          tokenUpdate =
            update;

          tokenOptions =
            options;

          return {
            _id:
              "507f191e810c19729de860ea",
          };
        };

      const result =
        await requestStudentPasswordReset({
          login:
            "STUDENT@EXAMPLE.COM",

          now:
            fixedNow,

          deliverReset:
            async (payload) => {
              deliveredPayload =
                payload;
            },
        });

      /*
       * Public-facing caller receives no raw
       * token or account-existence information.
       */
      assert.equal(
        result,
        undefined
      );

      assert.equal(
        tokenFilter.userId,
        fakeUserId
      );

      assert.equal(
        tokenFilter
          .$or[0]
          .requestedAt
          .$lte
          .toISOString(),
        "2026-09-05T11:58:00.000Z"
      );

      assert.match(
        tokenUpdate
          .$set
          .tokenHash,
        /^[a-f0-9]{64}$/
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            tokenUpdate.$set,
            "rawToken"
          ),
        false
      );

      assert.equal(
        tokenUpdate
          .$set
          .expiresAt
          .toISOString(),
        "2026-09-05T12:15:00.000Z"
      );

      assert.equal(
        tokenUpdate
          .$set
          .consumedAt,
        null
      );

      assert.deepEqual(
        tokenUpdate
          .$setOnInsert,
        {
          tenantId:
            "pravixoedutech",
        }
      );

      assert.equal(
        tokenOptions.upsert,
        true
      );

      assert.equal(
        tokenOptions
          .runValidators,
        true
      );

      /*
       * unique userId schema + upsert by userId
       * gives one reset record per student.
       */
      assert.equal(
        PasswordResetToken
          .schema
          .path("userId")
          .options
          .unique,
        true
      );

      assert.equal(
        deliveredPayload.toEmail,
        "student@example.com"
      );

      assert.equal(
        deliveredPayload
          .rawToken
          .length,
        43
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            deliveredPayload,
            "tokenHash"
          ),
        false
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            deliveredPayload,
            "userId"
          ),
        false
      );
    } finally {
      User.findOne =
        originalUserFindOne;

      PasswordResetToken
        .findOneAndUpdate =
        originalTokenUpdate;
    }
  }
);

test(
  "unknown or ineligible account stays silent and never delivers reset token",
  { concurrency: false },
  async () => {
    const originalUserFindOne =
      User.findOne;

    const originalTokenUpdate =
      PasswordResetToken
        .findOneAndUpdate;

    try {
      let tokenStoreCalled =
        false;

      let deliveryCalled =
        false;

      User.findOne = (query) => {
        /*
         * Query itself proves that inactive and
         * non-student roles are excluded.
         */
        assert.equal(
          query.role,
          "student"
        );

        assert.equal(
          query.isActive,
          true
        );

        return {
          select:
            async () =>
              null,
        };
      };

      PasswordResetToken.findOneAndUpdate =
        async () => {
          tokenStoreCalled =
            true;

          throw new Error(
            "Token store must not run"
          );
        };

      const result =
        await requestStudentPasswordReset({
          login:
            "unknown@example.com",

          now:
            fixedNow,

          deliverReset:
            async () => {
              deliveryCalled =
                true;
            },
        });

      assert.equal(
        result,
        undefined
      );

      assert.equal(
        tokenStoreCalled,
        false
      );

      assert.equal(
        deliveryCalled,
        false
      );
    } finally {
      User.findOne =
        originalUserFindOne;

      PasswordResetToken
        .findOneAndUpdate =
        originalTokenUpdate;
    }
  }
);

test(
  "per-account resend cooldown is two minutes and remains undisclosed",
  { concurrency: false },
  async () => {
    assert.equal(
      PASSWORD_RESET_REQUEST_COOLDOWN_MS,
      2 * 60 * 1000
    );

    const originalUserFindOne =
      User.findOne;

    const originalTokenUpdate =
      PasswordResetToken
        .findOneAndUpdate;

    try {
      let capturedFilter;
      let deliveryCalled =
        false;

      User.findOne = () => ({
        select:
          async () => ({
            _id:
              fakeUserId,
            tenantId:
              "pravixoedutech",
            email:
              "student@example.com",
          }),
      });

      PasswordResetToken.findOneAndUpdate =
        async (filter) => {
          capturedFilter =
            filter;

          const error =
            new Error(
              "duplicate key"
            );

          error.code = 11000;

          throw error;
        };

      const result =
        await requestStudentPasswordReset({
          login:
            "student@example.com",

          now:
            fixedNow,

          deliverReset:
            async () => {
              deliveryCalled =
                true;
            },
        });

      assert.equal(
        capturedFilter
          .$or[0]
          .requestedAt
          .$lte
          .toISOString(),
        "2026-09-05T11:58:00.000Z"
      );

      assert.equal(
        result,
        undefined
      );

      assert.equal(
        deliveryCalled,
        false
      );
    } finally {
      User.findOne =
        originalUserFindOne;

      PasswordResetToken
        .findOneAndUpdate =
        originalTokenUpdate;
    }
  }
);

test(
  "delivery failure revokes only the exact undisclosed token",
  { concurrency: false },
  async () => {
    const originalUserFindOne =
      User.findOne;

    const originalTokenUpdate =
      PasswordResetToken
        .findOneAndUpdate;

    const originalDeleteOne =
      PasswordResetToken
        .deleteOne;

    try {
      let issuedHash;
      let cleanupFilter;

      User.findOne = () => ({
        select:
          async () => ({
            _id:
              fakeUserId,
            tenantId:
              "pravixoedutech",
            email:
              "student@example.com",
          }),
      });

      PasswordResetToken.findOneAndUpdate =
        async (
          filter,
          update
        ) => {
          issuedHash =
            update.$set.tokenHash;

          return {
            _id:
              "507f191e810c19729de860ea",
          };
        };

      PasswordResetToken.deleteOne =
        async (filter) => {
          cleanupFilter =
            filter;

          return {
            deletedCount: 1,
          };
        };

      const deliveryError =
        new Error(
          "simulated delivery failure"
        );

      await assert.rejects(
        requestStudentPasswordReset({
          login:
            "student@example.com",

          now:
            fixedNow,

          deliverReset:
            async () => {
              throw deliveryError;
            },
        }),
        (error) =>
          error === deliveryError
      );

      assert.equal(
        cleanupFilter.userId,
        fakeUserId
      );

      assert.equal(
        cleanupFilter.tokenHash,
        issuedHash
      );

      assert.equal(
        cleanupFilter.consumedAt,
        null
      );
    } finally {
      User.findOne =
        originalUserFindOne;

      PasswordResetToken
        .findOneAndUpdate =
        originalTokenUpdate;

      PasswordResetToken.deleteOne =
        originalDeleteOne;
    }
  }
);

test(
  "successful reset atomically consumes token, updates password, verifies email and invalidates session",
  { concurrency: false },
  async () => {
    const originalUserFindOne =
      User.findOne;

    const originalTokenUpdate =
      PasswordResetToken
        .findOneAndUpdate;

    const originalStartSession =
      mongoose.startSession;

    try {
      const generated =
        createPasswordResetToken(
          fixedNow
        );

      let transactionStarted =
        false;

      let sessionEnded =
        false;

      let claimFilter;
      let claimUpdate;
      let claimOptions;
      let userQuery;
      let saveOptions;

      const fakeSession = {
        withTransaction:
          async (callback) => {
            transactionStarted =
              true;

            await callback();
          },

        endSession:
          async () => {
            sessionEnded =
              true;
          },
      };

      mongoose.startSession =
        async () =>
          fakeSession;

      PasswordResetToken.findOneAndUpdate =
        async (
          filter,
          update,
          options
        ) => {
          claimFilter =
            filter;

          claimUpdate =
            update;

          claimOptions =
            options;

          return {
            userId:
              fakeUserId,
            tenantId:
              "pravixoedutech",
          };
        };

      const resetUser = {
        password:
          "old-hash-placeholder",

        activeSessionId:
          "OLD-SESSION",

        lastLoginDevice:
          "Old Browser",

        isEmailVerified:
          false,

        save:
          async (options) => {
            saveOptions =
              options;
          },
      };

      User.findOne = (query) => {
        userQuery =
          query;

        return {
          session:
            async (session) => {
              assert.equal(
                session,
                fakeSession
              );

              return resetUser;
            },
        };
      };

      const result =
        await resetStudentPassword({
          rawToken:
            generated.rawToken,

          newPassword:
            "NewSecurePassword123",

          now:
            fixedNow,
        });

      assert.deepEqual(
        result,
        {
          success: true,
          code:
            RESET_PASSWORD_RESULT_CODES
              .SUCCESS,
        }
      );

      assert.equal(
        transactionStarted,
        true
      );

      assert.equal(
        sessionEnded,
        true
      );

      assert.equal(
        claimFilter.tokenHash,
        generated.tokenHash
      );

      /*
       * Replay protection.
       */
      assert.equal(
        claimFilter.consumedAt,
        null
      );

      /*
       * Authorization does not rely on TTL cleanup.
       * Expired tokens fail this query immediately.
       */
      assert.equal(
        claimFilter
          .expiresAt
          .$gt,
        fixedNow
      );

      assert.equal(
        claimUpdate
          .$set
          .consumedAt,
        fixedNow
      );

      assert.equal(
        claimOptions.session,
        fakeSession
      );

      assert.equal(
        userQuery._id,
        fakeUserId
      );

      assert.equal(
        userQuery.tenantId,
        "pravixoedutech"
      );

      assert.equal(
        userQuery.role,
        "student"
      );

      assert.equal(
        userQuery.isActive,
        true
      );

      assert.equal(
        resetUser.password,
        "NewSecurePassword123"
      );

      assert.equal(
        resetUser.activeSessionId,
        ""
      );

      assert.equal(
        resetUser.lastLoginDevice,
        ""
      );

      assert.equal(
        resetUser.isEmailVerified,
        true
      );

      assert.equal(
        saveOptions.session,
        fakeSession
      );
    } finally {
      User.findOne =
        originalUserFindOne;

      PasswordResetToken
        .findOneAndUpdate =
        originalTokenUpdate;

      mongoose.startSession =
        originalStartSession;
    }
  }
);

test(
  "expired, consumed or unknown reset token fails without user lookup",
  { concurrency: false },
  async () => {
    const originalUserFindOne =
      User.findOne;

    const originalTokenUpdate =
      PasswordResetToken
        .findOneAndUpdate;

    const originalStartSession =
      mongoose.startSession;

    try {
      const generated =
        createPasswordResetToken(
          fixedNow
        );

      let userLookupCalled =
        false;

      let sessionEnded =
        false;

      let claimFilter;

      const fakeSession = {
        withTransaction:
          async (callback) => {
            await callback();
          },

        endSession:
          async () => {
            sessionEnded =
              true;
          },
      };

      mongoose.startSession =
        async () =>
          fakeSession;

      PasswordResetToken.findOneAndUpdate =
        async (filter) => {
          claimFilter =
            filter;

          /*
           * Simulates no record matching:
           * - consumedAt:null
           * - expiresAt > now
           */
          return null;
        };

      User.findOne = () => {
        userLookupCalled =
          true;

        throw new Error(
          "User lookup must not run"
        );
      };

      const result =
        await resetStudentPassword({
          rawToken:
            generated.rawToken,

          newPassword:
            "AnotherSecurePassword123",

          now:
            fixedNow,
        });

      assert.equal(
        result.success,
        false
      );

      assert.equal(
        result.code,
        RESET_PASSWORD_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
      );

      assert.equal(
        claimFilter.tokenHash,
        generated.tokenHash
      );

      assert.equal(
        claimFilter.consumedAt,
        null
      );

      assert.equal(
        claimFilter
          .expiresAt
          .$gt,
        fixedNow
      );

      assert.equal(
        userLookupCalled,
        false
      );

      assert.equal(
        sessionEnded,
        true
      );
    } finally {
      User.findOne =
        originalUserFindOne;

      PasswordResetToken
        .findOneAndUpdate =
        originalTokenUpdate;

      mongoose.startSession =
        originalStartSession;
    }
  }
);

test(
  "malformed token and invalid password fail before MongoDB transaction",
  { concurrency: false },
  async () => {
    const originalStartSession =
      mongoose.startSession;

    try {
      let sessionStarted =
        false;

      mongoose.startSession =
        async () => {
          sessionStarted =
            true;

          throw new Error(
            "Session must not start"
          );
        };

      const malformed =
        await resetStudentPassword({
          rawToken:
            "not-a-valid-token",

          newPassword:
            "ValidPassword123",

          now:
            fixedNow,
        });

      assert.equal(
        malformed.success,
        false
      );

      assert.equal(
        malformed.code,
        RESET_PASSWORD_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
      );

      assert.equal(
        sessionStarted,
        false
      );

      const generated =
        createPasswordResetToken(
          fixedNow
        );

      const badPassword =
        await resetStudentPassword({
          rawToken:
            generated.rawToken,

          newPassword:
            "short",

          now:
            fixedNow,
        });

      assert.equal(
        badPassword.success,
        false
      );

      assert.equal(
        badPassword.code,
        RESET_PASSWORD_RESULT_CODES
          .INVALID_PASSWORD
      );

      assert.equal(
        sessionStarted,
        false
      );
    } finally {
      mongoose.startSession =
        originalStartSession;
    }
  }
);

test(
  "password reset uses User save hook path rather than direct password database update",
  () => {
    const userSource =
      readBackendSource(
        "src/models/User.js"
      );

    const serviceSource =
      readBackendSource(
        "src/services/passwordResetService.js"
      );

    assert.ok(
      userSource.includes(
        'userSchema.pre("save", async function ()'
      )
    );

    assert.ok(
      userSource.includes(
        'if (!this.isModified("password"))'
      )
    );

    assert.ok(
      userSource.includes(
        "bcrypt.hash(this.password, salt)"
      )
    );

    assert.ok(
      serviceSource.includes(
        "user.password ="
      )
    );

    assert.ok(
      serviceSource.includes(
        "await user.save({"
      )
    );

    const forbiddenDirectUpdates = [
      "User.updateOne",
      "User.updateMany",
      "User.findOneAndUpdate",
    ];

    for (
      const forbidden of
        forbiddenDirectUpdates
    ) {
      assert.equal(
        serviceSource.includes(
          forbidden
        ),
        false
      );
    }
  }
);

test(
  "password reset service contains no raw-token logging, JWT reset token or HTTP response authority",
  () => {
    const serviceSource =
      readBackendSource(
        "src/services/passwordResetService.js"
      );

    const securitySource =
      readBackendSource(
        "src/utils/passwordResetSecurity.js"
      );

    const forbiddenServiceAnchors = [
      "console.log",
      "console.error",
      "res.json",
      "res.status",
      "req.body",
      "jsonwebtoken",
      "JWT_SECRET",
      "Math.random",
    ];

    for (
      const forbidden of
        forbiddenServiceAnchors
    ) {
      assert.equal(
        serviceSource.includes(
          forbidden
        ),
        false
      );
    }

    assert.ok(
      securitySource.includes(
        "randomBytes(PASSWORD_RESET_TOKEN_BYTES)"
      )
    );

    assert.ok(
      securitySource.includes(
        '.createHash("sha256")'
      )
    );

    assert.equal(
      securitySource.includes(
        "Math.random"
      ),
      false
    );
  }
);
