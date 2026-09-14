const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");

const User = require("../src/models/User");

const EmailVerificationToken =
  require("../src/models/EmailVerificationToken");

const {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_RESULT_CODES,
  normalizeVerificationLogin,
  buildEligibleStudentVerificationQuery,
  issueStudentEmailVerification,
  requestStudentEmailVerification,
  verifyStudentEmail,
} = require(
  "../src/services/emailVerificationService"
);

const {
  hashEmailVerificationToken,
  hashEmailVerificationAddress,
} = require(
  "../src/utils/emailVerificationSecurity"
);

const serialTest = (
  name,
  fn
) =>
  test(
    name,
    {
      concurrency: false,
    },
    fn
  );

const ORIGINALS = {
  userFindOne:
    User.findOne,

  tokenFindOne:
    EmailVerificationToken.findOne,

  tokenFindOneAndUpdate:
    EmailVerificationToken.findOneAndUpdate,

  tokenDeleteOne:
    EmailVerificationToken.deleteOne,

  startSession:
    mongoose.startSession,
};

const restorePatchedMethods = () => {
  User.findOne =
    ORIGINALS.userFindOne;

  EmailVerificationToken.findOne =
    ORIGINALS.tokenFindOne;

  EmailVerificationToken.findOneAndUpdate =
    ORIGINALS.tokenFindOneAndUpdate;

  EmailVerificationToken.deleteOne =
    ORIGINALS.tokenDeleteOne;

  mongoose.startSession =
    ORIGINALS.startSession;
};

const makeLeanQuery = (
  value
) => {
  return {
    select() {
      return this;
    },

    async lean() {
      return value;
    },
  };
};

const makeSessionQuery = (
  value
) => {
  return {
    select() {
      return this;
    },

    async session() {
      return value;
    },
  };
};

const makeFakeSession = ({
  onTransaction,
} = {}) => {
  let transactionCalls = 0;
  let endSessionCalls = 0;

  const session = {
    async withTransaction(callback) {
      transactionCalls += 1;

      if (
        typeof onTransaction ===
        "function"
      ) {
        return onTransaction(
          callback
        );
      }

      return callback();
    },

    async endSession() {
      endSessionCalls += 1;
    },
  };

  return {
    session,

    get transactionCalls() {
      return transactionCalls;
    },

    get endSessionCalls() {
      return endSessionCalls;
    },
  };
};

const makeStudent = ({
  id =
    new mongoose.Types.ObjectId(),
  tenantId =
    "pravixoedutech",
  email =
    "student@example.com",
  isActive =
    true,
  isEmailVerified =
    false,
  activeSessionId =
    "legacy-session",
  lastLoginDevice =
    "Legacy Browser",
  saveImpl,
} = {}) => {
  let saveCalls = 0;
  let saveOptions = null;

  const user = {
    _id: id,
    tenantId,
    role: "student",
    email,
    isActive,
    isEmailVerified,
    activeSessionId,
    lastLoginDevice,

    async save(options) {
      saveCalls += 1;
      saveOptions =
        options || null;

      if (
        typeof saveImpl ===
        "function"
      ) {
        return saveImpl(
          options
        );
      }

      return this;
    },
  };

  return {
    user,

    get saveCalls() {
      return saveCalls;
    },

    get saveOptions() {
      return saveOptions;
    },
  };
};

const makeDuplicateUserIdError =
  () => {
    const error =
      new Error(
        "duplicate key"
      );

    error.code = 11000;

    error.keyPattern = {
      userId: 1,
    };

    return error;
  };

serialTest(
  "verification constants and identity normalization are stable",
  async () => {
    assert.equal(
      EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
      120000
    );

    assert.deepEqual(
      normalizeVerificationLogin(
        " Student@Example.COM "
      ),
      {
        type: "email",
        value:
          "student@example.com",
      }
    );

    assert.deepEqual(
      normalizeVerificationLogin(
        "99988-84444"
      ),
      {
        type: "mobile",
        value:
          "9998884444",
      }
    );

    assert.equal(
      normalizeVerificationLogin(
        "+91 99988 84444"
      ),
      null
    );

    assert.equal(
      normalizeVerificationLogin(
        "not-an-email"
      ),
      null
    );

    const query =
      buildEligibleStudentVerificationQuery(
        "Student@Example.COM"
      );

    assert.deepEqual(
      query,
      {
        email:
          "student@example.com",
        role:
          "student",
        isActive:
          true,
        isEmailVerified: {
          $ne: true,
        },
      }
    );
  }
);

serialTest(
  "initial issuance persists hashes only and delivers raw token only through callback",
  async () => {
    try {
      const now =
        new Date(
          "2026-09-06T10:00:00.000Z"
        );

      const {
        user,
      } =
        makeStudent({
          activeSessionId:
            "",
          lastLoginDevice:
            "",
        });

      let updateCall =
        null;

      let delivered =
        null;

      EmailVerificationToken
        .findOneAndUpdate =
        async (
          filter,
          update,
          options
        ) => {
          updateCall = {
            filter,
            update,
            options,
          };

          return {
            _id:
              new mongoose.Types.ObjectId(),
          };
        };

      EmailVerificationToken
        .deleteOne =
        async () => {
          throw new Error(
            "cleanup should not run"
          );
        };

      const result =
        await issueStudentEmailVerification({
          user,
          now,
          enforceCooldown:
            false,

          deliverVerification:
            async (payload) => {
              delivered =
                payload;
            },
        });

      assert.deepEqual(
        result,
        {
          success: true,
          code:
            EMAIL_VERIFICATION_RESULT_CODES
              .ISSUED,
        }
      );

      assert.ok(
        updateCall
      );

      assert.equal(
        updateCall.filter.userId,
        user._id
      );

      assert.equal(
        updateCall.filter.tenantId,
        "pravixoedutech"
      );

      assert.equal(
        updateCall.filter.$or,
        undefined
      );

      assert.equal(
        updateCall.options.upsert,
        true
      );

      assert.equal(
        updateCall.options.returnDocument,
        "after"
      );

      assert.equal(
        updateCall.options.runValidators,
        true
      );

      assert.equal(
        updateCall.options.setDefaultsOnInsert,
        true
      );

      assert.equal(
        updateCall.update.$set
          .consumedAt,
        null
      );

      assert.equal(
        updateCall.update.$set
          .requestedAt,
        now
      );

      assert.equal(
        updateCall.update.$set
          .expiresAt.getTime() -
          now.getTime(),
        86_400_000
      );

      assert.equal(
        updateCall.update.$setOnInsert
          .userId,
        user._id
      );

      assert.equal(
        updateCall.update.$setOnInsert
          .tenantId,
        "pravixoedutech"
      );

      assert.ok(
        delivered
      );

      assert.match(
        delivered.rawToken,
        /^[A-Za-z0-9_-]{43}$/
      );

      assert.equal(
        delivered.toEmail,
        "student@example.com"
      );

      assert.equal(
        delivered.expiresAt
          .getTime(),
        updateCall.update.$set
          .expiresAt.getTime()
      );

      assert.equal(
        updateCall.update.$set
          .tokenHash,
        hashEmailVerificationToken(
          delivered.rawToken
        )
      );

      assert.equal(
        updateCall.update.$set
          .emailHash,
        hashEmailVerificationAddress(
          delivered.toEmail
        )
      );

      const serializedUpdate =
        JSON.stringify(
          updateCall.update
        );

      assert.equal(
        serializedUpdate.includes(
          delivered.rawToken
        ),
        false
      );

      assert.equal(
        serializedUpdate.includes(
          delivered.toEmail
        ),
        false
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty.call(
            result,
            "rawToken"
          ),
        false
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty.call(
            result,
            "email"
          ),
        false
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "ineligible student does not create or deliver verification credential",
  async () => {
    try {
      let persistenceCalls =
        0;

      let deliveryCalls =
        0;

      EmailVerificationToken
        .findOneAndUpdate =
        async () => {
          persistenceCalls += 1;
        };

      const {
        user,
      } =
        makeStudent({
          isEmailVerified:
            true,
        });

      const result =
        await issueStudentEmailVerification({
          user,

          deliverVerification:
            async () => {
              deliveryCalls += 1;
            },
        });

      assert.equal(
        result.success,
        false
      );

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INELIGIBLE
      );

      assert.equal(
        persistenceCalls,
        0
      );

      assert.equal(
        deliveryCalls,
        0
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "resend cooldown returns hidden cooldown result without delivery",
  async () => {
    try {
      const now =
        new Date(
          "2026-09-06T10:00:00.000Z"
        );

      const {
        user,
      } =
        makeStudent();

      let deliveryCalls =
        0;

      let persistedFilter =
        null;

      EmailVerificationToken
        .findOneAndUpdate =
        async (filter) => {
          persistedFilter =
            filter;

          throw makeDuplicateUserIdError();
        };

      EmailVerificationToken
        .findOne =
        () =>
          makeLeanQuery({
            tenantId:
              "pravixoedutech",

            requestedAt:
              new Date(
                now.getTime() -
                  30_000
              ),
          });

      const result =
        await issueStudentEmailVerification({
          user,
          now,
          enforceCooldown:
            true,

          deliverVerification:
            async () => {
              deliveryCalls += 1;
            },
        });

      assert.equal(
        result.success,
        false
      );

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .COOLDOWN
      );

      assert.equal(
        deliveryCalls,
        0
      );

      assert.ok(
        Array.isArray(
          persistedFilter.$or
        )
      );

      assert.equal(
        persistedFilter.$or.length,
        2
      );

      assert.equal(
        persistedFilter.$or[0]
          .requestedAt.$lte
          .getTime(),
        now.getTime() -
          EMAIL_VERIFICATION_RESEND_COOLDOWN_MS
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "duplicate-key is not silently converted to cooldown without matching recent same-tenant record",
  async () => {
    try {
      const now =
        new Date(
          "2026-09-06T10:00:00.000Z"
        );

      const {
        user,
      } =
        makeStudent();

      const duplicateError =
        makeDuplicateUserIdError();

      EmailVerificationToken
        .findOneAndUpdate =
        async () => {
          throw duplicateError;
        };

      EmailVerificationToken
        .findOne =
        () =>
          makeLeanQuery({
            tenantId:
              "different-tenant",

            requestedAt:
              new Date(
                now.getTime() -
                  10_000
              ),
          });

      await assert.rejects(
        issueStudentEmailVerification({
          user,
          now,
          enforceCooldown:
            true,

          deliverVerification:
            async () => {},
        }),
        (error) =>
          error ===
          duplicateError
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "delivery failure removes only exact failed hashed credential and preserves original error",
  async () => {
    try {
      const {
        user,
      } =
        makeStudent();

      let persistedTokenHash =
        "";

      let cleanupFilter =
        null;

      EmailVerificationToken
        .findOneAndUpdate =
        async (
          filter,
          update
        ) => {
          persistedTokenHash =
            update.$set
              .tokenHash;

          return {
            _id:
              new mongoose.Types.ObjectId(),
          };
        };

      EmailVerificationToken
        .deleteOne =
        async (filter) => {
          cleanupFilter =
            filter;

          /*
           * Cleanup failure must not replace the
           * original delivery failure.
           */
          throw new Error(
            "simulated cleanup failure"
          );
        };

      const deliveryError =
        new Error(
          "simulated delivery failure"
        );

      await assert.rejects(
        issueStudentEmailVerification({
          user,

          deliverVerification:
            async () => {
              throw deliveryError;
            },
        }),
        (error) =>
          error ===
          deliveryError
      );

      assert.ok(
        cleanupFilter
      );

      assert.equal(
        cleanupFilter.userId,
        user._id
      );

      assert.equal(
        cleanupFilter.tenantId,
        "pravixoedutech"
      );

      assert.equal(
        cleanupFilter.tokenHash,
        persistedTokenHash
      );

      assert.match(
        cleanupFilter.tokenHash,
        /^[a-f0-9]{64}$/
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "public resend lookup is active unverified student only",
  async () => {
    try {
      let receivedQuery =
        null;

      let deliveryCalls =
        0;

      User.findOne =
        (query) => {
          receivedQuery =
            query;

          return makeLeanQuery(
            null
          );
        };

      const result =
        await requestStudentEmailVerification({
          login:
            " Student@Example.COM ",

          deliverVerification:
            async () => {
              deliveryCalls += 1;
            },
        });

      assert.deepEqual(
        receivedQuery,
        {
          email:
            "student@example.com",
          role:
            "student",
          isActive:
            true,
          isEmailVerified: {
            $ne: true,
          },
        }
      );

      assert.equal(
        result.success,
        false
      );

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INELIGIBLE
      );

      assert.equal(
        deliveryCalls,
        0
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "malformed resend identity fails before database lookup",
  async () => {
    try {
      let lookupCalls =
        0;

      User.findOne =
        () => {
          lookupCalls += 1;

          throw new Error(
            "database lookup should not run"
          );
        };

      const result =
        await requestStudentEmailVerification({
          login:
            "+91 99988 84444",

          deliverVerification:
            async () => {},
        });

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INELIGIBLE
      );

      assert.equal(
        lookupCalls,
        0
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "malformed verification token is rejected before session or database access",
  async () => {
    try {
      let sessionCalls =
        0;

      mongoose.startSession =
        async () => {
          sessionCalls += 1;

          throw new Error(
            "session must not start"
          );
        };

      EmailVerificationToken
        .findOne =
        () => {
          throw new Error(
            "database must not be queried"
          );
        };

      const result =
        await verifyStudentEmail({
          rawToken:
            "invalid-token",
        });

      assert.equal(
        result.success,
        false
      );

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
      );

      assert.equal(
        sessionCalls,
        0
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "missing or expired verification record returns invalid result and closes session",
  async () => {
    try {
      const rawToken =
        crypto
          .randomBytes(32)
          .toString("base64url");

      const now =
        new Date(
          "2026-09-06T10:00:00.000Z"
        );

      const fake =
        makeFakeSession();

      let tokenQuery =
        null;

      mongoose.startSession =
        async () =>
          fake.session;

      EmailVerificationToken
        .findOne =
        (query) => {
          tokenQuery =
            query;

          return makeSessionQuery(
            null
          );
        };

      const result =
        await verifyStudentEmail({
          rawToken,
          now,
        });

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
      );

      assert.equal(
        tokenQuery.tokenHash,
        hashEmailVerificationToken(
          rawToken
        )
      );

      assert.equal(
        tokenQuery.consumedAt,
        null
      );

      assert.equal(
        tokenQuery.expiresAt
          .$gt,
        now
      );

      assert.equal(
        fake.transactionCalls,
        1
      );

      assert.equal(
        fake.endSessionCalls,
        1
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "email binding mismatch cannot consume token or verify account",
  async () => {
    try {
      const rawToken =
        crypto
          .randomBytes(32)
          .toString("base64url");

      const fake =
        makeFakeSession();

      const userId =
        new mongoose.Types.ObjectId();

      const record = {
        _id:
          new mongoose.Types.ObjectId(),

        userId,

        tenantId:
          "pravixoedutech",

        emailHash:
          hashEmailVerificationAddress(
            "old@example.com"
          ),
      };

      const student =
        makeStudent({
          id:
            userId,

          email:
            "new@example.com",
        });

      let consumeCalls =
        0;

      mongoose.startSession =
        async () =>
          fake.session;

      EmailVerificationToken
        .findOne =
        () =>
          makeSessionQuery(
            record
          );

      User.findOne =
        () =>
          makeSessionQuery(
            student.user
          );

      EmailVerificationToken
        .findOneAndUpdate =
        async () => {
          consumeCalls += 1;

          throw new Error(
            "token must not be consumed"
          );
        };

      const result =
        await verifyStudentEmail({
          rawToken,
        });

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
      );

      assert.equal(
        consumeCalls,
        0
      );

      assert.equal(
        student.saveCalls,
        0
      );

      assert.equal(
        student.user
          .isEmailVerified,
        false
      );

      assert.equal(
        fake.endSessionCalls,
        1
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "inactive student cannot consume otherwise valid verification token",
  async () => {
    try {
      const rawToken =
        crypto
          .randomBytes(32)
          .toString("base64url");

      const fake =
        makeFakeSession();

      const userId =
        new mongoose.Types.ObjectId();

      const email =
        "student@example.com";

      const record = {
        _id:
          new mongoose.Types.ObjectId(),

        userId,

        tenantId:
          "pravixoedutech",

        emailHash:
          hashEmailVerificationAddress(
            email
          ),
      };

      const student =
        makeStudent({
          id:
            userId,
          email,
          isActive:
            false,
        });

      let consumeCalls =
        0;

      mongoose.startSession =
        async () =>
          fake.session;

      EmailVerificationToken
        .findOne =
        () =>
          makeSessionQuery(
            record
          );

      User.findOne =
        () =>
          makeSessionQuery(
            student.user
          );

      EmailVerificationToken
        .findOneAndUpdate =
        async () => {
          consumeCalls += 1;
        };

      const result =
        await verifyStudentEmail({
          rawToken,
        });

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
      );

      assert.equal(
        consumeCalls,
        0
      );

      assert.equal(
        student.saveCalls,
        0
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "successful verification atomically consumes token, verifies student and clears legacy session",
  async () => {
    try {
      const rawToken =
        crypto
          .randomBytes(32)
          .toString("base64url");

      const now =
        new Date(
          "2026-09-06T10:00:00.000Z"
        );

      const fake =
        makeFakeSession();

      const userId =
        new mongoose.Types.ObjectId();

      const email =
        "student@example.com";

      const record = {
        _id:
          new mongoose.Types.ObjectId(),

        userId,

        tenantId:
          "pravixoedutech",

        emailHash:
          hashEmailVerificationAddress(
            email
          ),
      };

      const student =
        makeStudent({
          id:
            userId,
          email,
          activeSessionId:
            "legacy-session",
          lastLoginDevice:
            "Old Browser",
        });

      let consumeCall =
        null;

      mongoose.startSession =
        async () =>
          fake.session;

      EmailVerificationToken
        .findOne =
        () =>
          makeSessionQuery(
            record
          );

      User.findOne =
        () =>
          makeSessionQuery(
            student.user
          );

      EmailVerificationToken
        .findOneAndUpdate =
        async (
          filter,
          update,
          options
        ) => {
          consumeCall = {
            filter,
            update,
            options,
          };

          return {
            ...record,
            consumedAt:
              now,
          };
        };

      const result =
        await verifyStudentEmail({
          rawToken,
          now,
        });

      assert.deepEqual(
        result,
        {
          success: true,
          code:
            EMAIL_VERIFICATION_RESULT_CODES
              .VERIFIED,
        }
      );

      assert.ok(
        consumeCall
      );

      assert.equal(
        consumeCall.filter._id,
        record._id
      );

      assert.equal(
        consumeCall.filter.tokenHash,
        hashEmailVerificationToken(
          rawToken
        )
      );

      assert.equal(
        consumeCall.filter
          .consumedAt,
        null
      );

      assert.equal(
        consumeCall.filter
          .expiresAt.$gt,
        now
      );

      assert.equal(
        consumeCall.update.$set
          .consumedAt,
        now
      );

      assert.equal(
        consumeCall.options
          .returnDocument,
        "after"
      );

      assert.equal(
        consumeCall.options
          .session,
        fake.session
      );

      assert.equal(
        student.user
          .isEmailVerified,
        true
      );

      assert.equal(
        student.user
          .activeSessionId,
        ""
      );

      assert.equal(
        student.user
          .lastLoginDevice,
        ""
      );

      assert.equal(
        student.saveCalls,
        1
      );

      assert.equal(
        student.saveOptions
          .session,
        fake.session
      );

      assert.equal(
        fake.transactionCalls,
        1
      );

      assert.equal(
        fake.endSessionCalls,
        1
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty.call(
            result,
            "token"
          ),
        false
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "already-verified trusted account consumes old verification token without destroying newer session",
  async () => {
    try {
      const rawToken =
        crypto
          .randomBytes(32)
          .toString("base64url");

      const fake =
        makeFakeSession();

      const userId =
        new mongoose.Types.ObjectId();

      const email =
        "student@example.com";

      const record = {
        _id:
          new mongoose.Types.ObjectId(),

        userId,

        tenantId:
          "pravixoedutech",

        emailHash:
          hashEmailVerificationAddress(
            email
          ),
      };

      const student =
        makeStudent({
          id:
            userId,
          email,
          isEmailVerified:
            true,
          activeSessionId:
            "new-legitimate-session",
          lastLoginDevice:
            "New Browser",
        });

      let consumeCalls =
        0;

      mongoose.startSession =
        async () =>
          fake.session;

      EmailVerificationToken
        .findOne =
        () =>
          makeSessionQuery(
            record
          );

      User.findOne =
        () =>
          makeSessionQuery(
            student.user
          );

      EmailVerificationToken
        .findOneAndUpdate =
        async () => {
          consumeCalls += 1;

          return {
            ...record,
            consumedAt:
              new Date(),
          };
        };

      const result =
        await verifyStudentEmail({
          rawToken,
        });

      assert.equal(
        result.success,
        true
      );

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .ALREADY_VERIFIED
      );

      assert.equal(
        consumeCalls,
        1
      );

      assert.equal(
        student.saveCalls,
        0
      );

      assert.equal(
        student.user
          .activeSessionId,
        "new-legitimate-session"
      );

      assert.equal(
        student.user
          .lastLoginDevice,
        "New Browser"
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "atomic consume race returns invalid result without changing student",
  async () => {
    try {
      const rawToken =
        crypto
          .randomBytes(32)
          .toString("base64url");

      const fake =
        makeFakeSession();

      const userId =
        new mongoose.Types.ObjectId();

      const email =
        "student@example.com";

      const record = {
        _id:
          new mongoose.Types.ObjectId(),

        userId,

        tenantId:
          "pravixoedutech",

        emailHash:
          hashEmailVerificationAddress(
            email
          ),
      };

      const student =
        makeStudent({
          id:
            userId,
          email,
        });

      mongoose.startSession =
        async () =>
          fake.session;

      EmailVerificationToken
        .findOne =
        () =>
          makeSessionQuery(
            record
          );

      User.findOne =
        () =>
          makeSessionQuery(
            student.user
          );

      EmailVerificationToken
        .findOneAndUpdate =
        async () =>
          null;

      const result =
        await verifyStudentEmail({
          rawToken,
        });

      assert.equal(
        result.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
      );

      assert.equal(
        student.saveCalls,
        0
      );

      assert.equal(
        student.user
          .isEmailVerified,
        false
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "verification token cannot be replayed after successful one-time consumption",
  async () => {
    try {
      const rawToken =
        crypto
          .randomBytes(32)
          .toString("base64url");

      const fakeOne =
        makeFakeSession();

      const fakeTwo =
        makeFakeSession();

      const sessions = [
        fakeOne.session,
        fakeTwo.session,
      ];

      let sessionIndex =
        0;

      mongoose.startSession =
        async () =>
          sessions[
            sessionIndex++
          ];

      const userId =
        new mongoose.Types.ObjectId();

      const email =
        "student@example.com";

      const record = {
        _id:
          new mongoose.Types.ObjectId(),

        userId,

        tenantId:
          "pravixoedutech",

        emailHash:
          hashEmailVerificationAddress(
            email
          ),
      };

      const student =
        makeStudent({
          id:
            userId,
          email,
        });

      let consumed =
        false;

      EmailVerificationToken
        .findOne =
        () =>
          makeSessionQuery(
            consumed
              ? null
              : record
          );

      User.findOne =
        () =>
          makeSessionQuery(
            student.user
          );

      EmailVerificationToken
        .findOneAndUpdate =
        async () => {
          if (consumed) {
            return null;
          }

          consumed =
            true;

          return {
            ...record,
            consumedAt:
              new Date(),
          };
        };

      const first =
        await verifyStudentEmail({
          rawToken,
        });

      const second =
        await verifyStudentEmail({
          rawToken,
        });

      assert.equal(
        first.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .VERIFIED
      );

      assert.equal(
        second.code,
        EMAIL_VERIFICATION_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
      );

      assert.equal(
        student.saveCalls,
        1
      );

      assert.equal(
        fakeOne.endSessionCalls,
        1
      );

      assert.equal(
        fakeTwo.endSessionCalls,
        1
      );
    } finally {
      restorePatchedMethods();
    }
  }
);

serialTest(
  "transactional user-save failure propagates and session is always closed",
  async () => {
    try {
      const rawToken =
        crypto
          .randomBytes(32)
          .toString("base64url");

      const fake =
        makeFakeSession();

      const userId =
        new mongoose.Types.ObjectId();

      const email =
        "student@example.com";

      const record = {
        _id:
          new mongoose.Types.ObjectId(),

        userId,

        tenantId:
          "pravixoedutech",

        emailHash:
          hashEmailVerificationAddress(
            email
          ),
      };

      const saveError =
        new Error(
          "simulated user-save failure"
        );

      const student =
        makeStudent({
          id:
            userId,
          email,

          saveImpl:
            async () => {
              throw saveError;
            },
        });

      mongoose.startSession =
        async () =>
          fake.session;

      EmailVerificationToken
        .findOne =
        () =>
          makeSessionQuery(
            record
          );

      User.findOne =
        () =>
          makeSessionQuery(
            student.user
          );

      EmailVerificationToken
        .findOneAndUpdate =
        async () => ({
          ...record,
          consumedAt:
            new Date(),
        });

      await assert.rejects(
        verifyStudentEmail({
          rawToken,
        }),
        (error) =>
          error ===
          saveError
      );

      assert.equal(
        fake.transactionCalls,
        1
      );

      assert.equal(
        fake.endSessionCalls,
        1
      );

      /*
       * This mocked test proves transaction usage,
       * failure propagation and session cleanup.
       *
       * Actual MongoDB rollback semantics are tested
       * separately against Atlas.
       */
    } finally {
      restorePatchedMethods();
    }
  }
);

test.after(() => {
  restorePatchedMethods();
});
