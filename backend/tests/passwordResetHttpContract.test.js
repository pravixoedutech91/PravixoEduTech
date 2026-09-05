const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");

const User =
  require("../src/models/User");

const PasswordResetToken =
  require("../src/models/PasswordResetToken");

const {
  createPasswordResetToken,
} =
  require("../src/utils/passwordResetSecurity");

const {
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
} =
  require("../src/middleware/passwordResetRateLimitMiddleware");

const {
  sendPasswordResetEmail,
} =
  require("../src/services/passwordResetEmailService");

const {
  buildStudentPasswordResetUrl,
  getPasswordResetFrontendOrigin,
} =
  require("../src/services/passwordResetLinkService");

const {
  forgotPassword,
  resetPassword,
} =
  require("../src/controllers/authController");

const router =
  require("../src/routes/authRoutes");

const GENERIC_FORGOT_MESSAGE =
  "If an eligible account exists, password reset instructions have been sent.";

const INVALID_RESET_MESSAGE =
  "This password reset link is invalid or has expired. Please request a new one.";

const SUCCESS_RESET_MESSAGE =
  "Password reset successfully. Please sign in again.";

const makeResponse = () => ({
  statusCode: 200,
  body: undefined,

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(payload) {
    this.body = payload;
    return this;
  },
});

const restoreEnvironmentValue = (
  key,
  value
) => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

const captureRuntimeState = () => ({
  userFindOne:
    User.findOne,

  tokenFindOneAndUpdate:
    PasswordResetToken.findOneAndUpdate,

  tokenDeleteOne:
    PasswordResetToken.deleteOne,

  startSession:
    mongoose.startSession,

  fetch:
    globalThis.fetch,

  consoleError:
    console.error,

  NODE_ENV:
    process.env.NODE_ENV,

  RAILWAY_ENVIRONMENT_NAME:
    process.env.RAILWAY_ENVIRONMENT_NAME,

  RAILWAY_DEPLOYMENT_ID:
    process.env.RAILWAY_DEPLOYMENT_ID,

  PASSWORD_RESET_FRONTEND_ORIGIN:
    process.env.PASSWORD_RESET_FRONTEND_ORIGIN,

  POSTMARK_SERVER_TOKEN:
    process.env.POSTMARK_SERVER_TOKEN,

  POSTMARK_FROM_EMAIL:
    process.env.POSTMARK_FROM_EMAIL,

  POSTMARK_MESSAGE_STREAM:
    process.env.POSTMARK_MESSAGE_STREAM,
});

const restoreRuntimeState = (
  original
) => {
  User.findOne =
    original.userFindOne;

  PasswordResetToken.findOneAndUpdate =
    original.tokenFindOneAndUpdate;

  PasswordResetToken.deleteOne =
    original.tokenDeleteOne;

  mongoose.startSession =
    original.startSession;

  globalThis.fetch =
    original.fetch;

  console.error =
    original.consoleError;

  restoreEnvironmentValue(
    "NODE_ENV",
    original.NODE_ENV
  );

  restoreEnvironmentValue(
    "RAILWAY_ENVIRONMENT_NAME",
    original.RAILWAY_ENVIRONMENT_NAME
  );

  restoreEnvironmentValue(
    "RAILWAY_DEPLOYMENT_ID",
    original.RAILWAY_DEPLOYMENT_ID
  );

  restoreEnvironmentValue(
    "PASSWORD_RESET_FRONTEND_ORIGIN",
    original.PASSWORD_RESET_FRONTEND_ORIGIN
  );

  restoreEnvironmentValue(
    "POSTMARK_SERVER_TOKEN",
    original.POSTMARK_SERVER_TOKEN
  );

  restoreEnvironmentValue(
    "POSTMARK_FROM_EMAIL",
    original.POSTMARK_FROM_EMAIL
  );

  restoreEnvironmentValue(
    "POSTMARK_MESSAGE_STREAM",
    original.POSTMARK_MESSAGE_STREAM
  );
};

const configureLocalRecoveryEnvironment =
  () => {
    process.env.NODE_ENV =
      "development";

    delete process.env
      .RAILWAY_ENVIRONMENT_NAME;

    delete process.env
      .RAILWAY_DEPLOYMENT_ID;

    delete process.env
      .PASSWORD_RESET_FRONTEND_ORIGIN;

    process.env.POSTMARK_SERVER_TOKEN =
      "TEST_SERVER_TOKEN";

    process.env.POSTMARK_FROM_EMAIL =
      "security@pravixo.example";

    process.env.POSTMARK_MESSAGE_STREAM =
      "outbound";
  };

test(
  "Postmark reset adapter uses fixed endpoint and disables credential tracking",
  { concurrency: false },
  async () => {
    let request;

    const resetUrl =
      "https://app.pravixo.example/student/reset-password#token=ABC_123-xyz";

    const result =
      await sendPasswordResetEmail({
        toEmail:
          "student@example.com",

        resetUrl,

        expiresAt:
          new Date(
            "2026-09-05T12:15:00.000Z"
          ),

        env: {
          POSTMARK_SERVER_TOKEN:
            "SECRET_SERVER_TOKEN",

          POSTMARK_FROM_EMAIL:
            "security@pravixo.example",

          POSTMARK_MESSAGE_STREAM:
            "outbound",
        },

        fetchImpl:
          async (url, options) => {
            request = {
              url,
              options,
            };

            return {
              status: 200,

              json:
                async () => ({
                  ErrorCode: 0,
                  Message: "OK",
                  MessageID:
                    "persistent-test-message-id",
                }),
            };
          },
      });

    assert.equal(
      request.url,
      "https://api.postmarkapp.com/email"
    );

    assert.equal(
      request.options.method,
      "POST"
    );

    assert.equal(
      request.options.redirect,
      "error"
    );

    assert.equal(
      request.options.headers[
        "X-Postmark-Server-Token"
      ],
      "SECRET_SERVER_TOKEN"
    );

    const body =
      JSON.parse(
        request.options.body
      );

    assert.equal(
      body.TrackOpens,
      false
    );

    assert.equal(
      body.TrackLinks,
      "None"
    );

    assert.equal(
      body.MessageStream,
      "outbound"
    );

    assert.equal(
      body.To,
      "student@example.com"
    );

    assert.ok(
      body.TextBody.includes(
        resetUrl
      )
    );

    assert.equal(
      request.options.body.includes(
        "SECRET_SERVER_TOKEN"
      ),
      false
    );

    assert.deepEqual(
      result,
      {
        messageId:
          "persistent-test-message-id",
      }
    );

    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          result,
          "resetUrl"
        ),
      false
    );

    assert.equal(
      Object.prototype
        .hasOwnProperty
        .call(
          result,
          "toEmail"
        ),
      false
    );
  }
);

test(
  "trusted reset link uses dedicated origin and fragment-only credential",
  { concurrency: false },
  () => {
    const original =
      captureRuntimeState();

    try {
      const generated =
        createPasswordResetToken(
          new Date(
            "2026-09-05T12:00:00.000Z"
          )
        );

      configureLocalRecoveryEnvironment();

      process.env.FRONTEND_URL =
        "https://attacker.example";

      assert.equal(
        getPasswordResetFrontendOrigin(),
        "http://localhost:3000"
      );

      const localUrl =
        buildStudentPasswordResetUrl({
          rawToken:
            generated.rawToken,

          origin:
            "https://attacker.example",

          path:
            "/steal",

          redirect:
            "https://attacker.example",
        });

      const parsedLocal =
        new URL(localUrl);

      assert.equal(
        parsedLocal.origin,
        "http://localhost:3000"
      );

      assert.equal(
        parsedLocal.pathname,
        "/student/reset-password"
      );

      assert.equal(
        parsedLocal.search,
        ""
      );

      assert.equal(
        parsedLocal.hash,
        "#token=" +
          generated.rawToken
      );

      assert.equal(
        localUrl.includes(
          "?token="
        ),
        false
      );

      process.env.NODE_ENV =
        "production";

      process.env
        .PASSWORD_RESET_FRONTEND_ORIGIN =
        "https://app.pravixo.example/";

      const hostedUrl =
        buildStudentPasswordResetUrl({
          rawToken:
            generated.rawToken,
        });

      const parsedHosted =
        new URL(
          hostedUrl
        );

      assert.equal(
        parsedHosted.origin,
        "https://app.pravixo.example"
      );

      assert.equal(
        parsedHosted.pathname,
        "/student/reset-password"
      );

      assert.equal(
        parsedHosted.search,
        ""
      );

      assert.equal(
        parsedHosted.hash,
        "#token=" +
          generated.rawToken
      );
    } finally {
      restoreRuntimeState(
        original
      );
    }
  }
);

test(
  "public recovery routes are exactly limiter then controller",
  () => {
    const routeLayers =
      router.stack.filter(
        (layer) =>
          layer &&
          layer.route
      );

    const findRoute = (
      routePath
    ) =>
      routeLayers.find(
        (layer) =>
          layer.route.path ===
          routePath
      );

    const forgotRoute =
      findRoute(
        "/forgot-password"
      );

    const resetRoute =
      findRoute(
        "/reset-password"
      );

    assert.ok(
      forgotRoute
    );

    assert.ok(
      resetRoute
    );

    assert.equal(
      forgotRoute.route.methods.post,
      true
    );

    assert.equal(
      resetRoute.route.methods.post,
      true
    );

    const forgotHandlers =
      forgotRoute.route.stack.map(
        (layer) =>
          layer.handle
      );

    const resetHandlers =
      resetRoute.route.stack.map(
        (layer) =>
          layer.handle
      );

    assert.deepEqual(
      forgotHandlers,
      [
        forgotPasswordRateLimiter,
        forgotPassword,
      ]
    );

    assert.deepEqual(
      resetHandlers,
      [
        resetPasswordRateLimiter,
        resetPassword,
      ]
    );
  }
);

test(
  "eligible and unknown forgot-password requests expose identical public responses",
  { concurrency: false },
  async () => {
    const original =
      captureRuntimeState();

    try {
      configureLocalRecoveryEnvironment();

      console.error =
        () => {};

      let sentEmail;

      User.findOne = (query) => {
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
            async () => ({
              _id:
                "507f1f77bcf86cd799439011",

              tenantId:
                "pravixoedutech",

              email:
                "student@example.com",
            }),
        };
      };

      PasswordResetToken.findOneAndUpdate =
        async (
          filter,
          update
        ) => {
          assert.match(
            update.$set.tokenHash,
            /^[a-f0-9]{64}$/
          );

          assert.equal(
            Object.prototype
              .hasOwnProperty
              .call(
                update.$set,
                "rawToken"
              ),
            false
          );

          return {
            _id:
              "507f191e810c19729de860ea",
          };
        };

      globalThis.fetch =
        async (
          url,
          options
        ) => {
          assert.equal(
            url,
            "https://api.postmarkapp.com/email"
          );

          sentEmail =
            JSON.parse(
              options.body
            );

          return {
            status: 200,

            json:
              async () => ({
                ErrorCode: 0,
                Message: "OK",
                MessageID:
                  "eligible-message-id",
              }),
          };
        };

      const eligible =
        makeResponse();

      await forgotPassword(
        {
          body: {
            login:
              "STUDENT@EXAMPLE.COM",

            tenantId:
              "attacker-tenant",

            role:
              "super_admin",

            resetUrl:
              "https://attacker.example",

            token:
              "attacker-token",
          },
        },
        eligible
      );

      assert.equal(
        eligible.statusCode,
        200
      );

      assert.deepEqual(
        eligible.body,
        {
          success: true,
          message:
            GENERIC_FORGOT_MESSAGE,
        }
      );

      assert.equal(
        sentEmail.To,
        "student@example.com"
      );

      assert.equal(
        sentEmail.TrackOpens,
        false
      );

      assert.equal(
        sentEmail.TrackLinks,
        "None"
      );

      assert.ok(
        sentEmail.TextBody.includes(
          "http://localhost:3000/student/reset-password#token="
        )
      );

      assert.equal(
        sentEmail.TextBody.includes(
          "?token="
        ),
        false
      );

      assert.equal(
        sentEmail.TextBody.includes(
          "attacker.example"
        ),
        false
      );

      const tokenMatch =
        sentEmail.TextBody.match(
          /#token=([A-Za-z0-9_-]{43})/
        );

      assert.ok(
        tokenMatch
      );

      assert.equal(
        JSON.stringify(
          eligible.body
        ).includes(
          tokenMatch[1]
        ),
        false
      );

      let deliveryCalled =
        false;

      User.findOne = () => ({
        select:
          async () =>
            null,
      });

      globalThis.fetch =
        async () => {
          deliveryCalled = true;

          throw new Error(
            "Unknown account must not send mail"
          );
        };

      const unknown =
        makeResponse();

      await forgotPassword(
        {
          body: {
            login:
              "unknown@example.com",
          },
        },
        unknown
      );

      assert.equal(
        deliveryCalled,
        false
      );

      assert.equal(
        unknown.statusCode,
        eligible.statusCode
      );

      assert.deepEqual(
        unknown.body,
        eligible.body
      );
    } finally {
      restoreRuntimeState(
        original
      );
    }
  }
);

test(
  "provider failure preserves generic response and revokes exact issued token",
  { concurrency: false },
  async () => {
    const original =
      captureRuntimeState();

    try {
      configureLocalRecoveryEnvironment();

      console.error =
        () => {};

      User.findOne = () => ({
        select:
          async () => ({
            _id:
              "507f1f77bcf86cd799439011",

            tenantId:
              "pravixoedutech",

            email:
              "student@example.com",
          }),
      });

      let issuedHash;
      let cleanupVerified =
        false;

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
          assert.equal(
            filter.tokenHash,
            issuedHash
          );

          assert.equal(
            filter.consumedAt,
            null
          );

          cleanupVerified =
            true;

          return {
            deletedCount: 1,
          };
        };

      globalThis.fetch =
        async () => ({
          status: 500,

          json:
            async () => ({
              ErrorCode: 500,
              Message:
                "Provider failure",
            }),
        });

      const response =
        makeResponse();

      await forgotPassword(
        {
          body: {
            login:
              "student@example.com",
          },
        },
        response
      );

      assert.equal(
        cleanupVerified,
        true
      );

      assert.equal(
        response.statusCode,
        200
      );

      assert.deepEqual(
        response.body,
        {
          success: true,
          message:
            GENERIC_FORGOT_MESSAGE,
        }
      );
    } finally {
      restoreRuntimeState(
        original
      );
    }
  }
);

test(
  "hosted reset-link configuration failure creates no forgot-password enumeration oracle",
  { concurrency: false },
  async () => {
    const original =
      captureRuntimeState();

    try {
      configureLocalRecoveryEnvironment();

      process.env.NODE_ENV =
        "production";

      delete process.env
        .PASSWORD_RESET_FRONTEND_ORIGIN;

      console.error =
        () => {};

      User.findOne = () => ({
        select:
          async () => ({
            _id:
              "507f1f77bcf86cd799439011",

            tenantId:
              "pravixoedutech",

            email:
              "student@example.com",
          }),
      });

      PasswordResetToken.findOneAndUpdate =
        async () => ({
          _id:
            "507f191e810c19729de860ea",
        });

      let cleanupCalled =
        false;

      PasswordResetToken.deleteOne =
        async () => {
          cleanupCalled =
            true;

          return {
            deletedCount: 1,
          };
        };

      let providerCalled =
        false;

      globalThis.fetch =
        async () => {
          providerCalled =
            true;

          throw new Error(
            "Provider must not run"
          );
        };

      const response =
        makeResponse();

      await forgotPassword(
        {
          body: {
            login:
              "student@example.com",
          },
        },
        response
      );

      assert.equal(
        providerCalled,
        false
      );

      assert.equal(
        cleanupCalled,
        true
      );

      assert.equal(
        response.statusCode,
        200
      );

      assert.deepEqual(
        response.body,
        {
          success: true,
          message:
            GENERIC_FORGOT_MESSAGE,
        }
      );
    } finally {
      restoreRuntimeState(
        original
      );
    }
  }
);

test(
  "reset endpoint safely handles malformed token and password validation",
  { concurrency: false },
  async () => {
    const original =
      captureRuntimeState();

    try {
      configureLocalRecoveryEnvironment();

      console.error =
        () => {};

      let sessionStarted =
        false;

      mongoose.startSession =
        async () => {
          sessionStarted = true;

          throw new Error(
            "Transaction must not start"
          );
        };

      const malformed =
        makeResponse();

      await resetPassword(
        {
          body: {
            token:
              "invalid-token",

            password:
              "ValidPassword123",

            tenantId:
              "attacker",

            role:
              "super_admin",
          },
        },
        malformed
      );

      assert.equal(
        sessionStarted,
        false
      );

      assert.equal(
        malformed.statusCode,
        400
      );

      assert.deepEqual(
        malformed.body,
        {
          success: false,
          message:
            INVALID_RESET_MESSAGE,
        }
      );

      const generated =
        createPasswordResetToken(
          new Date(
            "2026-09-05T12:00:00.000Z"
          )
        );

      const invalidPassword =
        makeResponse();

      await resetPassword(
        {
          body: {
            token:
              generated.rawToken,

            password:
              "short",
          },
        },
        invalidPassword
      );

      assert.equal(
        sessionStarted,
        false
      );

      assert.equal(
        invalidPassword.statusCode,
        400
      );

      assert.deepEqual(
        invalidPassword.body,
        {
          success: false,
          message:
            "Password must be at least 8 characters",
        }
      );
    } finally {
      restoreRuntimeState(
        original
      );
    }
  }
);

test(
  "successful reset invalidates old session and never auto-logs in",
  { concurrency: false },
  async () => {
    const original =
      captureRuntimeState();

    try {
      configureLocalRecoveryEnvironment();

      const generated =
        createPasswordResetToken(
          new Date(
            "2026-09-05T12:00:00.000Z"
          )
        );

      let transactionStarted =
        false;

      let sessionEnded =
        false;

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
          assert.equal(
            filter.consumedAt,
            null
          );

          assert.equal(
            filter
              .expiresAt
              .$gt instanceof Date,
            true
          );

          assert.equal(
            options.session,
            fakeSession
          );

          return {
            userId:
              "507f1f77bcf86cd799439011",

            tenantId:
              "pravixoedutech",
          };
        };

      const user = {
        password:
          "old-placeholder",

        activeSessionId:
          "OLD-SESSION",

        lastLoginDevice:
          "Old Browser",

        isEmailVerified:
          false,

        save:
          async (options) => {
            assert.equal(
              options.session,
              fakeSession
            );
          },
      };

      User.findOne = (query) => ({
        session:
          async (session) => {
            assert.equal(
              session,
              fakeSession
            );

            assert.equal(
              query.role,
              "student"
            );

            assert.equal(
              query.isActive,
              true
            );

            assert.equal(
              query.tenantId,
              "pravixoedutech"
            );

            return user;
          },
      });

      const response =
        makeResponse();

      await resetPassword(
        {
          body: {
            token:
              generated.rawToken,

            password:
              "NewSecurePassword123",

            tenantId:
              "attacker",

            role:
              "super_admin",

            activeSessionId:
              "ATTACKER-SESSION",
          },
        },
        response
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
        user.password,
        "NewSecurePassword123"
      );

      assert.equal(
        user.activeSessionId,
        ""
      );

      assert.equal(
        user.lastLoginDevice,
        ""
      );

      assert.equal(
        user.isEmailVerified,
        true
      );

      assert.equal(
        response.statusCode,
        200
      );

      assert.deepEqual(
        response.body,
        {
          success: true,
          message:
            SUCCESS_RESET_MESSAGE,
        }
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            response.body,
            "token"
          ),
        false
      );

      assert.equal(
        Object.prototype
          .hasOwnProperty
          .call(
            response.body,
            "data"
          ),
        false
      );

      assert.equal(
        JSON.stringify(
          response.body
        ).includes(
          generated.rawToken
        ),
        false
      );
    } finally {
      restoreRuntimeState(
        original
      );
    }
  }
);

test(
  "hosted unexpected reset failure returns only sanitized internal error",
  { concurrency: false },
  async () => {
    const original =
      captureRuntimeState();

    try {
      configureLocalRecoveryEnvironment();

      process.env.NODE_ENV =
        "production";

      console.error =
        () => {};

      mongoose.startSession =
        async () => {
          throw new Error(
            "sensitive database topology detail"
          );
        };

      const generated =
        createPasswordResetToken(
          new Date()
        );

      const response =
        makeResponse();

      await resetPassword(
        {
          body: {
            token:
              generated.rawToken,

            password:
              "AnotherSecurePassword123",
          },
        },
        response
      );

      assert.equal(
        response.statusCode,
        500
      );

      assert.deepEqual(
        response.body,
        {
          success: false,
          message:
            "Internal server error",
        }
      );

      assert.equal(
        JSON.stringify(
          response.body
        ).includes(
          "sensitive database topology detail"
        ),
        false
      );
    } finally {
      restoreRuntimeState(
        original
      );
    }
  }
);

test(
  "recovery controller and routes retain public security boundaries",
  () => {
    const controllerSource =
      fs.readFileSync(
        path.join(
          __dirname,
          "..",
          "src",
          "controllers",
          "authController.js"
        ),
        "utf8"
      );

    const routesSource =
      fs.readFileSync(
        path.join(
          __dirname,
          "..",
          "src",
          "routes",
          "authRoutes.js"
        ),
        "utf8"
      );

    const forgotStart =
      controllerSource.indexOf(
        "// Forgot Student Password"
      );

    const resetStart =
      controllerSource.indexOf(
        "// Reset Student Password"
      );

    const getMeStart =
      controllerSource.indexOf(
        "// Get Logged In User Profile"
      );

    assert.ok(
      forgotStart >= 0
    );

    assert.ok(
      resetStart > forgotStart
    );

    assert.ok(
      getMeStart > resetStart
    );

    const forgotSource =
      controllerSource.slice(
        forgotStart,
        resetStart
      );

    const resetSource =
      controllerSource.slice(
        resetStart,
        getMeStart
      );

    assert.ok(
      forgotSource.includes(
        "PASSWORD_RESET_REQUEST_GENERIC_MESSAGE"
      )
    );

    assert.ok(
      forgotSource.includes(
        "res.status(200).json({"
      )
    );

    const forgotForbidden = [
      "res.status(400)",
      "res.status(401)",
      "res.status(403)",
      "res.status(404)",
      "res.status(409)",
      "res.status(500)",
      "generateToken(",
      "getInternalErrorMessage(",
      "req.query",
      "req.params",
      "req.headers",
    ];

    for (
      const forbidden of
        forgotForbidden
    ) {
      assert.equal(
        forgotSource.includes(
          forbidden
        ),
        false
      );
    }

    const resetForbidden = [
      "generateToken(",
      "jwt.sign(",
      "req.user",
      "req.query",
      "req.params",
      "req.headers",
      "sendPasswordResetEmail(",
    ];

    for (
      const forbidden of
        resetForbidden
    ) {
      assert.equal(
        resetSource.includes(
          forbidden
        ),
        false
      );
    }

    assert.ok(
      routesSource.includes(
        '"/forgot-password"'
      )
    );

    assert.ok(
      routesSource.includes(
        '"/reset-password"'
      )
    );

    assert.ok(
      routesSource.includes(
        "forgotPasswordRateLimiter"
      )
    );

    assert.ok(
      routesSource.includes(
        "resetPasswordRateLimiter"
      )
    );
  }
);
