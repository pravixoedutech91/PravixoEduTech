const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const User =
  require("../src/models/User");

const {
  logoutUser,
} =
  require("../src/controllers/authController");

const {
  protect,
} =
  require("../src/middleware/authMiddleware");

const {
  getInternalErrorMessage,
} =
  require("../src/utils/runtimeSecurity");

const createResponse = () => {
  return {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(payload) {
      this.body = payload;
      return this;
    },
  };
};

const withUserMethods = async (
  replacements,
  callback
) => {
  const originals = {};

  for (
    const [
      methodName,
      replacement,
    ] of Object.entries(
      replacements
    )
  ) {
    originals[methodName] =
      User[methodName];

    User[methodName] =
      replacement;
  }

  try {
    return await callback();
  }
  finally {
    for (
      const [
        methodName,
        original,
      ] of Object.entries(
        originals
      )
    ) {
      User[methodName] =
        original;
    }
  }
};

const runProtect = async (
  request
) => {
  const response =
    createResponse();

  let nextCount = 0;

  await protect(
    request,
    response,
    () => {
      nextCount += 1;
    }
  );

  return {
    response,
    nextCount,
  };
};

test(
  "current authenticated session is revoked with one exact conditional update",
  {
    concurrency: false,
  },
  async () => {
    const calls = [];

    await withUserMethods(
      {
        findOneAndUpdate:
          async (
            filter,
            update
          ) => {
            calls.push({
              filter,
              update,
            });

            return {
              _id:
                filter._id,
            };
          },
      },
      async () => {
        const request = {
          user: {
            _id:
              "student-current",
            role:
              "student",
          },

          authSessionId:
            "session-current",

          /*
           * Deliberately malicious values.
           * Logout authority must ignore them.
           */
          body: {
            userId:
              "attacker-user",
            sessionId:
              "attacker-session",
            activeSessionId:
              "attacker-active-session",
          },

          query: {
            userId:
              "query-user",
            sessionId:
              "query-session",
          },
        };

        const response =
          createResponse();

        await logoutUser(
          request,
          response
        );

        assert.equal(
          calls.length,
          1
        );

        assert.deepEqual(
          calls[0].filter,
          {
            _id:
              "student-current",

            activeSessionId:
              "session-current",
          }
        );

        assert.deepEqual(
          calls[0].update,
          {
            $set: {
              activeSessionId:
                "",

              lastLoginDevice:
                "",
            },
          }
        );

        assert.equal(
          response.statusCode,
          200
        );

        assert.deepEqual(
          response.body,
          {
            success:
              true,

            message:
              "Logout successful",
          }
        );
      }
    );
  }
);

test(
  "protect-to-controller race cannot clear a newer replacement session",
  {
    concurrency: false,
  },
  async () => {
    const state = {
      _id:
        "student-race",

      activeSessionId:
        "session-new",

      lastLoginDevice:
        "new-device",

      lastLoginAt:
        "2026-09-11T12:00:04.349Z",

      email:
        "race@example.test",

      role:
        "student",

      isEmailVerified:
        true,
    };

    let updateCalls = 0;

    await withUserMethods(
      {
        findOneAndUpdate:
          async (
            filter,
            update
          ) => {
            updateCalls += 1;

            if (
              filter._id !==
                state._id ||
              filter.activeSessionId !==
                state.activeSessionId
            ) {
              return null;
            }

            Object.assign(
              state,
              update.$set
            );

            return {
              ...state,
            };
          },
      },
      async () => {
        const response =
          createResponse();

        await logoutUser(
          {
            user: {
              _id:
                state._id,
            },

            /*
             * Session A passed protect earlier,
             * then login replaced it with Session B.
             */
            authSessionId:
              "session-old",
          },
          response
        );

        assert.equal(
          updateCalls,
          1
        );

        assert.equal(
          response.statusCode,
          200
        );

        assert.equal(
          response.body.success,
          true
        );

        assert.equal(
          state.activeSessionId,
          "session-new"
        );

        assert.equal(
          state.lastLoginDevice,
          "new-device"
        );

        assert.equal(
          state.lastLoginAt,
          "2026-09-11T12:00:04.349Z"
        );

        assert.equal(
          state.email,
          "race@example.test"
        );
      }
    );
  }
);

test(
  "student and admin logout use identical exact-session authority",
  {
    concurrency: false,
  },
  async () => {
    const calls = [];

    await withUserMethods(
      {
        findOneAndUpdate:
          async (
            filter,
            update
          ) => {
            calls.push({
              filter,
              update,
            });

            return null;
          },
      },
      async () => {
        const subjects = [
          {
            role:
              "student",
            id:
              "student-role-test",
            session:
              "student-session",
          },
          {
            role:
              "super_admin",
            id:
              "admin-role-test",
            session:
              "admin-session",
          },
        ];

        for (
          const subject of
            subjects
        ) {
          const response =
            createResponse();

          await logoutUser(
            {
              user: {
                _id:
                  subject.id,
                role:
                  subject.role,
              },

              authSessionId:
                subject.session,
            },
            response
          );

          assert.equal(
            response.statusCode,
            200
          );

          assert.equal(
            response.body.success,
            true
          );
        }

        assert.equal(
          calls.length,
          2
        );

        assert.deepEqual(
          calls[0].filter,
          {
            _id:
              "student-role-test",

            activeSessionId:
              "student-session",
          }
        );

        assert.deepEqual(
          calls[1].filter,
          {
            _id:
              "admin-role-test",

            activeSessionId:
              "admin-session",
          }
        );

        assert.deepEqual(
          calls[0].update,
          calls[1].update
        );

        assert.deepEqual(
          calls[0].update,
          {
            $set: {
              activeSessionId:
                "",

              lastLoginDevice:
                "",
            },
          }
        );
      }
    );
  }
);

test(
  "database failure returns centralized internal-error response and never false success",
  {
    concurrency: false,
  },
  async () => {
    const controlledError =
      new Error(
        "controlled secure logout database failure"
      );

    const expectedMessage =
      getInternalErrorMessage(
        controlledError
      );

    await withUserMethods(
      {
        findOneAndUpdate:
          async () => {
            throw controlledError;
          },
      },
      async () => {
        const response =
          createResponse();

        await logoutUser(
          {
            user: {
              _id:
                "failure-user",
            },

            authSessionId:
              "failure-session",
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
            success:
              false,

            message:
              expectedMessage,
          }
        );

        const serialized =
          JSON.stringify(
            response.body
          );

        assert.doesNotMatch(
          serialized,
          /activeSessionId|authSessionId|sessionId|token/i
        );
      }
    );
  }
);

test(
  "copied JWT is rejected by protect after successful server-side logout",
  {
    concurrency: false,
  },
  async () => {
    const originalSecret =
      process.env.JWT_SECRET;

    const testSecret =
      "pravixo-secure-logout-behavior-secret";

    process.env.JWT_SECRET =
      testSecret;

    const state = {
      _id:
        "jwt-user",

      tenantId:
        "pravixoedutech",

      role:
        "student",

      isEmailVerified:
        true,

      activeSessionId:
        "jwt-session-current",

      lastLoginDevice:
        "test-browser",
    };

    const token =
      jwt.sign(
        {
          id:
            state._id,

          tenantId:
            state.tenantId,

          role:
            state.role,

          sessionId:
            state.activeSessionId,
        },
        testSecret,
        {
          expiresIn:
            "5m",
        }
      );

    try {
      await withUserMethods(
        {
          findById:
            async () => {
              return {
                ...state,
              };
            },

          findOneAndUpdate:
            async (
              filter,
              update
            ) => {
              if (
                filter._id !==
                  state._id ||
                filter.activeSessionId !==
                  state.activeSessionId
              ) {
                return null;
              }

              Object.assign(
                state,
                update.$set
              );

              return {
                ...state,
              };
            },
        },
        async () => {
          const firstRequest = {
            headers: {
              authorization:
                `Bearer ${token}`,
            },
          };

          const beforeLogout =
            await runProtect(
              firstRequest
            );

          assert.equal(
            beforeLogout.nextCount,
            1
          );

          assert.equal(
            beforeLogout.response.statusCode,
            null
          );

          assert.equal(
            firstRequest.authSessionId,
            "jwt-session-current"
          );

          const logoutResponse =
            createResponse();

          await logoutUser(
            firstRequest,
            logoutResponse
          );

          assert.equal(
            logoutResponse.statusCode,
            200
          );

          assert.equal(
            state.activeSessionId,
            ""
          );

          assert.equal(
            state.lastLoginDevice,
            ""
          );

          const replayRequest = {
            headers: {
              authorization:
                `Bearer ${token}`,
            },
          };

          const afterLogout =
            await runProtect(
              replayRequest
            );

          assert.equal(
            afterLogout.nextCount,
            0
          );

          assert.equal(
            afterLogout.response.statusCode,
            401
          );

          assert.equal(
            afterLogout.response.body.success,
            false
          );

          assert.equal(
            afterLogout.response.body.message,
            "Session expired. Logged in from another device."
          );

          assert.equal(
            replayRequest.authSessionId,
            undefined
          );
        }
      );
    }
    finally {
      if (
        originalSecret ===
          undefined
      ) {
        delete process.env.JWT_SECRET;
      }
      else {
        process.env.JWT_SECRET =
          originalSecret;
      }
    }
  }
);

test(
  "logout preserves authenticated user snapshot and account-history fields",
  {
    concurrency: false,
  },
  async () => {
    const user = {
      _id:
        "snapshot-user",

      name:
        "Snapshot Student",

      mobile:
        "9999999999",

      email:
        "snapshot@example.test",

      tenantId:
        "pravixoedutech",

      role:
        "student",

      isActive:
        true,

      isEmailVerified:
        true,

      activeSessionId:
        "snapshot-session",

      lastLoginDevice:
        "snapshot-device",

      lastLoginAt:
        "2026-09-11T12:00:04.349Z",
    };

    const originalSnapshot =
      JSON.parse(
        JSON.stringify(
          user
        )
      );

    let capturedUpdate =
      null;

    await withUserMethods(
      {
        findOneAndUpdate:
          async (
            filter,
            update
          ) => {
            capturedUpdate =
              update;

            return null;
          },
      },
      async () => {
        const response =
          createResponse();

        await logoutUser(
          {
            user,
            authSessionId:
              "snapshot-session",
          },
          response
        );

        assert.equal(
          response.statusCode,
          200
        );

        assert.deepEqual(
          user,
          originalSnapshot
        );

        assert.deepEqual(
          capturedUpdate,
          {
            $set: {
              activeSessionId:
                "",

              lastLoginDevice:
                "",
            },
          }
        );

        assert.equal(
          Object.prototype
            .hasOwnProperty.call(
              capturedUpdate.$set,
              "lastLoginAt"
            ),
          false
        );

        for (
          const protectedField of [
            "name",
            "mobile",
            "email",
            "tenantId",
            "role",
            "isActive",
            "isEmailVerified",
            "password",
          ]
        ) {
          assert.equal(
            Object.prototype
              .hasOwnProperty.call(
                capturedUpdate.$set,
                protectedField
              ),
            false,
            `${protectedField} must not be mutated by logout`
          );
        }
      }
    );
  }
);