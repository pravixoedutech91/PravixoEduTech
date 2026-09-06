const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const User = require("../src/models/User");
const Tenant = require("../src/models/Tenant");
const EmailVerificationToken = require("../src/models/EmailVerificationToken");

const {
  validatePublicStudentRegistration,
} = require("../src/middleware/registrationValidationMiddleware");

const {
  resolvePublicRegistrationTenant,
} = require("../src/middleware/registrationTenantMiddleware");

const {
  checkStudentLimit,
} = require("../src/middleware/tenantLimitMiddleware");

const {
  requirePublicRegistrationAvailable,
} = require("../src/middleware/publicRegistrationMiddleware");

const {
  REGISTRATION_RATE_LIMIT_WINDOW_MS,
  REGISTRATION_RATE_LIMIT_MAX_REQUESTS,
  registrationRateLimiter,
} = require("../src/middleware/registrationRateLimitMiddleware");

const {
  registerUser,
  loginUser,
} = require("../src/controllers/authController");

const makeResponse = () => {
  return {
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
  };
};

const runMiddleware = async (middleware, req) => {
  const res = makeResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  return {
    res,
    nextCalled,
  };
};

const makeValidRegistrationBody = (overrides = {}) => {
  return {
    name: "Test Student",
    mobile: "9876543210",
    email: "student@example.com",
    password: "StrongPass123",
    referralCode: "",
    ...overrides,
  };
};

test("registration validation normalizes canonical input", async () => {
  const req = {
    body: makeValidRegistrationBody({
      name: "   Test    Student   ",
      mobile: "98765-43210",
      email: "  STUDENT@EXAMPLE.COM  ",
    }),
  };

  const { res, nextCalled } = await runMiddleware(
    validatePublicStudentRegistration,
    req
  );

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);

  assert.deepEqual(req.registrationInput, {
    name: "Test Student",
    mobile: "9876543210",
    email: "student@example.com",
    password: "StrongPass123",
    referralCode: "",
  });
});

test("registration validation creates sanitized session context", async () => {
  const req = {
    body: makeValidRegistrationBody({
      deviceInfo:
        "   PravixoEduTech Student Web   ",
    }),
  };

  const { nextCalled } = await runMiddleware(
    validatePublicStudentRegistration,
    req
  );

  assert.equal(nextCalled, true);

  assert.deepEqual(
    req.registrationSessionContext,
    {
      deviceInfo:
        "PravixoEduTech Student Web",
    }
  );
});

test("registration device info is optional and capped at 200 characters", async () => {
  const missingReq = {
    body: makeValidRegistrationBody(),
  };

  const missingResult = await runMiddleware(
    validatePublicStudentRegistration,
    missingReq
  );

  assert.equal(
    missingResult.nextCalled,
    true
  );

  assert.equal(
    missingReq.registrationSessionContext
      .deviceInfo,
    ""
  );

  const longReq = {
    body: makeValidRegistrationBody({
      deviceInfo: "A".repeat(250),
    }),
  };

  const longResult = await runMiddleware(
    validatePublicStudentRegistration,
    longReq
  );

  assert.equal(
    longResult.nextCalled,
    true
  );

  assert.equal(
    longReq.registrationSessionContext
      .deviceInfo.length,
    200
  );
});

test("registration validation strips tenant and role authority", async () => {
  const req = {
    body: makeValidRegistrationBody({
      tenantId: "another-institute",
      role: "super_admin",
    }),
  };

  const { nextCalled } = await runMiddleware(
    validatePublicStudentRegistration,
    req
  );

  assert.equal(nextCalled, true);

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      req.registrationInput,
      "tenantId"
    ),
    false
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      req.registrationInput,
      "role"
    ),
    false
  );
});

test("registration validation rejects invalid name", async () => {
  for (const name of [
    "A",
    "A".repeat(101),
  ]) {
    const req = {
      body: makeValidRegistrationBody({
        name,
      }),
    };

    const { res, nextCalled } =
      await runMiddleware(
        validatePublicStudentRegistration,
        req
      );

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(
      res.body.message,
      /Name must be between 2 and 100 characters/
    );
  }
});

test("registration validation rejects invalid mobile", async () => {
  for (const mobile of [
    "987654321",
    "98765432101",
    "not-a-mobile",
  ]) {
    const req = {
      body: makeValidRegistrationBody({
        mobile,
      }),
    };

    const { res, nextCalled } =
      await runMiddleware(
        validatePublicStudentRegistration,
        req
      );

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(
      res.body.message,
      /Mobile number must be exactly 10 digits/
    );
  }
});

test("registration validation rejects malformed email", async () => {
  for (const email of [
    "student",
    "student@",
    "@example.com",
    "student @example.com",
  ]) {
    const req = {
      body: makeValidRegistrationBody({
        email,
      }),
    };

    const { res, nextCalled } =
      await runMiddleware(
        validatePublicStudentRegistration,
        req
      );

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(
      res.body.message,
      /valid email address/
    );
  }
});

test("registration validation requires at least 8 password characters", async () => {
  const req = {
    body: makeValidRegistrationBody({
      password: "1234567",
    }),
  };

  const { res, nextCalled } = await runMiddleware(
    validatePublicStudentRegistration,
    req
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(
    res.body.message,
    /at least 8 characters/
  );
});

test("registration validation accepts 72-byte bcrypt boundary", async () => {
  const req = {
    body: makeValidRegistrationBody({
      password: "\u00e9".repeat(36),
    }),
  };

  assert.equal(
    Buffer.byteLength(req.body.password, "utf8"),
    72
  );

  const { nextCalled } = await runMiddleware(
    validatePublicStudentRegistration,
    req
  );

  assert.equal(nextCalled, true);
});

test("registration validation rejects password over 72 UTF-8 bytes", async () => {
  const req = {
    body: makeValidRegistrationBody({
      password: "\u00e9".repeat(37),
    }),
  };

  assert.equal(
    Buffer.byteLength(req.body.password, "utf8"),
    74
  );

  const { res, nextCalled } = await runMiddleware(
    validatePublicStudentRegistration,
    req
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(
    res.body.message,
    /Password is too long/
  );
});

test("trusted tenant resolver ignores body tenantId", async () => {
  const originalFindOne = Tenant.findOne;
  const originalConfiguredTenant =
    process.env.PUBLIC_REGISTRATION_TENANT_ID;

  let receivedFilter;

  try {
    process.env.PUBLIC_REGISTRATION_TENANT_ID =
      "pravixoedutech";

    Tenant.findOne = async (filter) => {
      receivedFilter = filter;

      return {
        slug: "pravixoedutech",
        isActive: true,
        limits: {
          maxStudents: 0,
        },
      };
    };

    const req = {
      body: {
        tenantId: "malicious-other-tenant",
      },
    };

    const { nextCalled } = await runMiddleware(
      resolvePublicRegistrationTenant,
      req
    );

    assert.equal(nextCalled, true);

    assert.deepEqual(receivedFilter, {
      slug: "pravixoedutech",
    });

    assert.equal(
      req.registrationTenantId,
      "pravixoedutech"
    );

    assert.equal(
      req.registrationTenant.slug,
      "pravixoedutech"
    );
  } finally {
    Tenant.findOne = originalFindOne;

    if (originalConfiguredTenant === undefined) {
      delete process.env.PUBLIC_REGISTRATION_TENANT_ID;
    } else {
      process.env.PUBLIC_REGISTRATION_TENANT_ID =
        originalConfiguredTenant;
    }
  }
});

test("student limit uses trusted registration tenant only", async () => {
  const originalCountDocuments =
    User.countDocuments;

  let receivedFilter;

  try {
    User.countDocuments = async (filter) => {
      receivedFilter = filter;
      return 3;
    };

    const req = {
      body: {
        tenantId: "malicious-other-tenant",
      },

      registrationTenantId: "pravixoedutech",

      registrationTenant: {
        slug: "pravixoedutech",
        limits: {
          maxStudents: 10,
        },
      },
    };

    const { nextCalled } = await runMiddleware(
      checkStudentLimit,
      req
    );

    assert.equal(nextCalled, true);

    assert.deepEqual(receivedFilter, {
      tenantId: "pravixoedutech",
      role: "student",
      isEmailVerified: true,
    });
  } finally {
    User.countDocuments =
      originalCountDocuments;
  }
});

test("student limit rejects missing or mismatched trusted tenant context", async () => {
  const originalCountDocuments =
    User.countDocuments;

  let databaseCalled = false;

  try {
    User.countDocuments = async () => {
      databaseCalled = true;
      return 0;
    };

    const req = {
      registrationTenantId: "pravixoedutech",
      registrationTenant: {
        slug: "another-institute",
        limits: {
          maxStudents: 10,
        },
      },
    };

    const { res, nextCalled } =
      await runMiddleware(
        checkStudentLimit,
        req
      );

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
    assert.equal(databaseCalled, false);
  } finally {
    User.countDocuments =
      originalCountDocuments;
  }
});

test("registration rate limiter contract is configured", () => {
  assert.equal(
    REGISTRATION_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
  );

  assert.equal(
    REGISTRATION_RATE_LIMIT_MAX_REQUESTS,
    20
  );

  assert.equal(
    typeof registrationRateLimiter,
    "function"
  );
});

test("register route preserves hardened middleware order", () => {
  const authRoutesPath = path.join(
    __dirname,
    "..",
    "src",
    "routes",
    "authRoutes.js"
  );

  const source = fs.readFileSync(
    authRoutesPath,
    "utf8"
  );

  const registerMarker =
    source.indexOf("// Register");

  const loginMarker =
    source.indexOf("// Login");

  assert.ok(registerMarker >= 0);
  assert.ok(loginMarker > registerMarker);

  const registerRegion = source.slice(
    registerMarker,
    loginMarker
  );

  const expectedOrder = [
    "requirePublicRegistrationAvailable",
    "registrationRateLimiter",
    "validatePublicStudentRegistration",
    "resolvePublicRegistrationTenant",
    "checkStudentLimit",
    "registerUser",
  ];

  let previousIndex = -1;

  for (const name of expectedOrder) {
    const currentIndex =
      registerRegion.indexOf(name);

    assert.ok(
      currentIndex > previousIndex,
      `${name} is missing or out of order`
    );

    previousIndex = currentIndex;
  }
});

test("registerUser creates pending unverified student and sends verification without JWT", async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  const originalVerificationFindOneAndUpdate =
    EmailVerificationToken.findOneAndUpdate;

  const originalVerificationDeleteOne =
    EmailVerificationToken.deleteOne;

  const originalFetch = globalThis.fetch;

  const originalNodeEnv =
    process.env.NODE_ENV;

  const originalRailwayEnvironmentName =
    process.env.RAILWAY_ENVIRONMENT_NAME;

  const originalRailwayDeploymentId =
    process.env.RAILWAY_DEPLOYMENT_ID;

  const originalVerificationOrigin =
    process.env.EMAIL_VERIFICATION_FRONTEND_ORIGIN;

  const originalPostmarkToken =
    process.env.POSTMARK_SERVER_TOKEN;

  const originalPostmarkFrom =
    process.env.POSTMARK_FROM_EMAIL;

  const originalPostmarkStream =
    process.env.POSTMARK_MESSAGE_STREAM;

  const restoreEnv = (key, value) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  let createPayload;
  let verificationWrite;
  let verificationDeleteCalls = 0;
  let fetchCalls = 0;
  let postmarkMessage;

  try {
    process.env.NODE_ENV = "production";

    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_DEPLOYMENT_ID;

    process.env.EMAIL_VERIFICATION_FRONTEND_ORIGIN =
      "https://student.example.com";

    process.env.POSTMARK_SERVER_TOKEN =
      "postmark-registration-contract-token";

    process.env.POSTMARK_FROM_EMAIL =
      "security@pravixo.example";

    process.env.POSTMARK_MESSAGE_STREAM =
      "outbound";

    User.findOne = async () => null;

    User.create = async (payload) => {
      createPayload = payload;

      return {
        _id: "507f1f77bcf86cd799439011",
        ...payload,
      };
    };

    EmailVerificationToken.findOneAndUpdate =
      async (filter, update) => {
        verificationWrite = {
          filter,
          update,
        };

        return {
          _id: "507f1f77bcf86cd799439012",
        };
      };

    EmailVerificationToken.deleteOne =
      async () => {
        verificationDeleteCalls += 1;

        return {
          deletedCount: 1,
        };
      };

    globalThis.fetch = async (url, options) => {
      fetchCalls += 1;

      assert.equal(
        url,
        "https://api.postmarkapp.com/email"
      );

      assert.equal(
        options.method,
        "POST"
      );

      assert.equal(
        options.redirect,
        "error"
      );

      assert.equal(
        options.headers["X-Postmark-Server-Token"],
        "postmark-registration-contract-token"
      );

      postmarkMessage =
        JSON.parse(options.body);

      return {
        ok: true,
        status: 200,

        json: async () => ({
          ErrorCode: 0,
          MessageID: "registration-contract-message-id",
        }),
      };
    };

    const req = {
      registrationTenantId:
        "pravixoedutech",

      registrationInput:
        makeValidRegistrationBody({
          referralCode: "",
        }),

      body: {
        tenantId:
          "malicious-other-tenant",

        role: "super_admin",

        deviceInfo:
          "must-not-create-registration-session",
      },
    };

    const res = makeResponse();

    await registerUser(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);

    assert.equal(
      res.body.code,
      "EMAIL_VERIFICATION_REQUIRED"
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body,
        "token"
      ),
      false
    );

    assert.equal(
      createPayload.tenantId,
      "pravixoedutech"
    );

    assert.equal(
      createPayload.role,
      "student"
    );

    assert.equal(
      createPayload.isActive,
      true
    );

    assert.equal(
      createPayload.isEmailVerified,
      false
    );

    assert.equal(
      createPayload.activeSessionId,
      ""
    );

    assert.equal(
      createPayload.lastLoginAt,
      null
    );

    assert.equal(
      createPayload.lastLoginDevice,
      ""
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        createPayload,
        "referralCode"
      ),
      false
    );

    assert.equal(
      res.body.data.tenantId,
      "pravixoedutech"
    );

    assert.equal(
      res.body.data.role,
      "student"
    );

    assert.equal(
      res.body.data.emailVerificationRequired,
      true
    );

    assert.equal(
      res.body.data.verificationEmailSent,
      true
    );

    assert.equal(
      res.body.data.referral,
      null
    );

    assert.equal(fetchCalls, 1);

    assert.equal(
      verificationDeleteCalls,
      0
    );

    assert.ok(verificationWrite);

    assert.equal(
      String(verificationWrite.filter.userId),
      "507f1f77bcf86cd799439011"
    );

    assert.equal(
      verificationWrite.filter.tenantId,
      "pravixoedutech"
    );

    assert.match(
      verificationWrite.update.$set.tokenHash,
      /^[a-f0-9]{64}$/
    );

    assert.match(
      verificationWrite.update.$set.emailHash,
      /^[a-f0-9]{64}$/
    );

    assert.equal(
      postmarkMessage.TrackOpens,
      false
    );

    assert.equal(
      postmarkMessage.TrackLinks,
      "None"
    );

    const rawTokenMatch =
      postmarkMessage.TextBody.match(
        /#token=([A-Za-z0-9_-]{43})/
      );

    assert.ok(rawTokenMatch);

    const rawToken =
      rawTokenMatch[1];

    const expectedTokenHash =
      require("node:crypto")
        .createHash("sha256")
        .update(rawToken, "utf8")
        .digest("hex");

    assert.equal(
      verificationWrite.update.$set.tokenHash,
      expectedTokenHash
    );

    assert.equal(
      postmarkMessage.TextBody.includes(
        "?token="
      ),
      false
    );
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;

    EmailVerificationToken.findOneAndUpdate =
      originalVerificationFindOneAndUpdate;

    EmailVerificationToken.deleteOne =
      originalVerificationDeleteOne;

    globalThis.fetch = originalFetch;

    restoreEnv(
      "NODE_ENV",
      originalNodeEnv
    );

    restoreEnv(
      "RAILWAY_ENVIRONMENT_NAME",
      originalRailwayEnvironmentName
    );

    restoreEnv(
      "RAILWAY_DEPLOYMENT_ID",
      originalRailwayDeploymentId
    );

    restoreEnv(
      "EMAIL_VERIFICATION_FRONTEND_ORIGIN",
      originalVerificationOrigin
    );

    restoreEnv(
      "POSTMARK_SERVER_TOKEN",
      originalPostmarkToken
    );

    restoreEnv(
      "POSTMARK_FROM_EMAIL",
      originalPostmarkFrom
    );

    restoreEnv(
      "POSTMARK_MESSAGE_STREAM",
      originalPostmarkStream
    );
  }
});

test("registerUser preserves pending account when verification delivery fails", async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  const originalVerificationFindOneAndUpdate =
    EmailVerificationToken.findOneAndUpdate;

  const originalVerificationDeleteOne =
    EmailVerificationToken.deleteOne;

  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;

  const originalNodeEnv =
    process.env.NODE_ENV;

  const originalRailwayEnvironmentName =
    process.env.RAILWAY_ENVIRONMENT_NAME;

  const originalRailwayDeploymentId =
    process.env.RAILWAY_DEPLOYMENT_ID;

  const originalVerificationOrigin =
    process.env.EMAIL_VERIFICATION_FRONTEND_ORIGIN;

  const originalPostmarkToken =
    process.env.POSTMARK_SERVER_TOKEN;

  const originalPostmarkFrom =
    process.env.POSTMARK_FROM_EMAIL;

  const originalPostmarkStream =
    process.env.POSTMARK_MESSAGE_STREAM;

  const restoreEnv = (key, value) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  let createPayload;
  let verificationWrite;
  let cleanupFilter;
  let fetchCalls = 0;
  let rawToken;

  const hostedLogs = [];

  try {
    process.env.NODE_ENV = "production";

    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_DEPLOYMENT_ID;

    process.env.EMAIL_VERIFICATION_FRONTEND_ORIGIN =
      "https://student.example.com";

    process.env.POSTMARK_SERVER_TOKEN =
      "postmark-registration-failure-token";

    process.env.POSTMARK_FROM_EMAIL =
      "security@pravixo.example";

    process.env.POSTMARK_MESSAGE_STREAM =
      "outbound";

    console.error = (...args) => {
      hostedLogs.push(args);
    };

    User.findOne = async () => null;

    User.create = async (payload) => {
      createPayload = payload;

      return {
        _id: "507f1f77bcf86cd799439021",
        ...payload,
      };
    };

    EmailVerificationToken.findOneAndUpdate =
      async (filter, update) => {
        verificationWrite = {
          filter,
          update,
        };

        return {
          _id: "507f1f77bcf86cd799439022",
        };
      };

    EmailVerificationToken.deleteOne =
      async (filter) => {
        cleanupFilter = filter;

        return {
          deletedCount: 1,
        };
      };

    globalThis.fetch = async (url, options) => {
      fetchCalls += 1;

      assert.equal(
        url,
        "https://api.postmarkapp.com/email"
      );

      const postmarkMessage =
        JSON.parse(options.body);

      const tokenMatch =
        postmarkMessage.TextBody.match(
          /#token=([A-Za-z0-9_-]{43})/
        );

      assert.ok(tokenMatch);

      rawToken = tokenMatch[1];

      return {
        ok: false,
        status: 503,

        json: async () => ({
          ErrorCode: 999,
          Message: "provider-private-detail",
        }),
      };
    };

    const req = {
      registrationTenantId:
        "pravixoedutech",

      registrationInput:
        makeValidRegistrationBody({
          mobile: "9876543211",
          email: "failure@example.com",
          referralCode: "",
        }),

      body: {
        tenantId:
          "malicious-other-tenant",

        role: "super_admin",
      },
    };

    const res = makeResponse();

    await registerUser(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);

    assert.equal(
      res.body.code,
      "EMAIL_VERIFICATION_REQUIRED"
    );

    assert.equal(
      res.body.data.emailVerificationRequired,
      true
    );

    assert.equal(
      res.body.data.verificationEmailSent,
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body,
        "token"
      ),
      false
    );

    assert.match(
      res.body.message,
      /verification email could not be sent/i
    );

    assert.equal(
      createPayload.isActive,
      true
    );

    assert.equal(
      createPayload.isEmailVerified,
      false
    );

    assert.equal(
      createPayload.activeSessionId,
      ""
    );

    assert.equal(
      createPayload.lastLoginAt,
      null
    );

    assert.equal(
      createPayload.lastLoginDevice,
      ""
    );

    assert.equal(fetchCalls, 1);

    assert.ok(verificationWrite);
    assert.ok(cleanupFilter);
    assert.ok(rawToken);

    assert.equal(
      cleanupFilter.tenantId,
      "pravixoedutech"
    );

    assert.equal(
      String(cleanupFilter.userId),
      "507f1f77bcf86cd799439021"
    );

    assert.equal(
      cleanupFilter.tokenHash,
      verificationWrite.update.$set.tokenHash
    );

    assert.notEqual(
      cleanupFilter.tokenHash,
      rawToken
    );

    const publicJson =
      JSON.stringify(res.body);

    assert.equal(
      publicJson.includes(
        "provider-private-detail"
      ),
      false
    );

    assert.equal(
      publicJson.includes(
        "postmark-registration-failure-token"
      ),
      false
    );

    assert.equal(
      publicJson.includes(rawToken),
      false
    );

    const logJson =
      JSON.stringify(hostedLogs);

    assert.equal(
      logJson.includes(
        "provider-private-detail"
      ),
      false
    );

    assert.equal(
      logJson.includes(
        "postmark-registration-failure-token"
      ),
      false
    );

    assert.equal(
      logJson.includes(
        "failure@example.com"
      ),
      false
    );

    assert.equal(
      logJson.includes(rawToken),
      false
    );
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;

    EmailVerificationToken.findOneAndUpdate =
      originalVerificationFindOneAndUpdate;

    EmailVerificationToken.deleteOne =
      originalVerificationDeleteOne;

    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;

    restoreEnv(
      "NODE_ENV",
      originalNodeEnv
    );

    restoreEnv(
      "RAILWAY_ENVIRONMENT_NAME",
      originalRailwayEnvironmentName
    );

    restoreEnv(
      "RAILWAY_DEPLOYMENT_ID",
      originalRailwayDeploymentId
    );

    restoreEnv(
      "EMAIL_VERIFICATION_FRONTEND_ORIGIN",
      originalVerificationOrigin
    );

    restoreEnv(
      "POSTMARK_SERVER_TOKEN",
      originalPostmarkToken
    );

    restoreEnv(
      "POSTMARK_FROM_EMAIL",
      originalPostmarkFrom
    );

    restoreEnv(
      "POSTMARK_MESSAGE_STREAM",
      originalPostmarkStream
    );
  }
});
test("registerUser returns 409 for pre-existing account", async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  let createCalled = false;

  try {
    User.findOne = async () => ({
      _id: "existing-user",
    });

    User.create = async () => {
      createCalled = true;
      throw new Error(
        "User.create should not be called"
      );
    };

    const req = {
      registrationTenantId: "pravixoedutech",

      registrationInput:
        makeValidRegistrationBody(),

      registrationSessionContext: {
        deviceInfo:
          "PravixoEduTech Student Web",
      },
    };

    const res = makeResponse();

    await registerUser(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(createCalled, false);

    assert.match(
      res.body.message,
      /already exists/
    );
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test("registerUser converts Mongo E11000 race into 409", async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  try {
    User.findOne = async () => null;

    User.create = async () => {
      const error = new Error(
        "duplicate key"
      );

      error.code = 11000;

      throw error;
    };

    const req = {
      registrationTenantId: "pravixoedutech",

      registrationInput:
        makeValidRegistrationBody(),

      registrationSessionContext: {
        deviceInfo:
          "PravixoEduTech Student Web",
      },
    };

    const res = makeResponse();

    await registerUser(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);

    assert.match(
      res.body.message,
      /already exists/
    );
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test("loginUser normalizes email login and device metadata", async () => {
  const originalFindOne = User.findOne;
  const originalJwtSecret =
    process.env.JWT_SECRET;

  let receivedFilter;
  let receivedProjection;
  let saveCalled = 0;

  const user = {
    _id: "login-student-1",
    tenantId: "pravixoedutech",
    role: "student",
    name: "Login Student",
    mobile: "9876543210",
    email: "student@example.com",
    isActive: true,
    isEmailVerified: true,
    activeSessionId: "",
    lastLoginAt: null,
    lastLoginDevice: "",
    matchPassword: async (value) =>
      value === "StrongPass123",
    save: async () => {
      saveCalled += 1;
    },
  };

  try {
    process.env.JWT_SECRET =
      "pravixo-login-test-secret";

    User.findOne = (filter) => {
      receivedFilter = filter;

      return {
        select: async (projection) => {
          receivedProjection = projection;
          return user;
        },
      };
    };

    const req = {
      body: {
        login: "  STUDENT@EXAMPLE.COM  ",
        password: "StrongPass123",
        deviceInfo: "   " + "A".repeat(250) + "   ",
      },
    };

    const res = makeResponse();

    await loginUser(req, res);

    assert.deepEqual(
      receivedFilter,
      {
        $or: [
          { mobile: "student@example.com" },
          { email: "student@example.com" },
        ],
      }
    );

    assert.equal(
      receivedProjection,
      "+password"
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(saveCalled, 1);

    assert.equal(
      user.lastLoginDevice.length,
      200
    );

    assert.equal(
      user.lastLoginDevice,
      "A".repeat(200)
    );

    assert.ok(
      user.lastLoginAt instanceof Date
    );

    assert.match(
      user.activeSessionId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const decoded = jwt.verify(
      res.body.token,
      process.env.JWT_SECRET
    );

    assert.equal(
      decoded.sessionId,
      user.activeSessionId
    );
  } finally {
    User.findOne = originalFindOne;

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET =
        originalJwtSecret;
    }
  }
});

test("loginUser normalizes formatted mobile login", async () => {
  const originalFindOne = User.findOne;
  const originalJwtSecret =
    process.env.JWT_SECRET;

  let receivedFilter;

  const user = {
    _id: "login-student-2",
    tenantId: "pravixoedutech",
    role: "student",
    name: "Mobile Student",
    mobile: "9876543210",
    email: "mobile@example.com",
    isActive: true,
    isEmailVerified: true,
    activeSessionId: "",
    lastLoginAt: null,
    lastLoginDevice: "",
    matchPassword: async () => true,
    save: async () => {},
  };

  try {
    process.env.JWT_SECRET =
      "pravixo-login-test-secret";

    User.findOne = (filter) => {
      receivedFilter = filter;

      return {
        select: async () => user,
      };
    };

    const req = {
      body: {
        login: "98765-43210",
        password: "StrongPass123",
      },
    };

    const res = makeResponse();

    await loginUser(req, res);

    assert.deepEqual(
      receivedFilter,
      {
        $or: [
          { mobile: "9876543210" },
          { email: "9876543210" },
        ],
      }
    );

    assert.equal(res.statusCode, 200);
  } finally {
    User.findOne = originalFindOne;

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET =
        originalJwtSecret;
    }
  }
});

test("loginUser rejects missing credentials before database lookup", async () => {
  const originalFindOne = User.findOne;

  let databaseCalled = false;

  try {
    User.findOne = () => {
      databaseCalled = true;

      throw new Error(
        "Database lookup should not run"
      );
    };

    const req = {
      body: {
        login: "   ",
        password: "   ",
      },
    };

    const res = makeResponse();

    await loginUser(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(databaseCalled, false);

    assert.equal(
      res.body.message,
      "Invalid login credentials"
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test("loginUser validates password before inactive or verification state disclosure", async () => {
  const originalFindOne = User.findOne;

  let passwordCalls = 0;
  let saveCalls = 0;

  const originalLastLoginAt =
    new Date("2026-01-01T00:00:00.000Z");

  const user = {
    _id: "login-security-bad-password",
    tenantId: "pravixoedutech",
    role: "student",
    name: "Security Student",
    mobile: "9876543201",
    email: "bad-password@example.com",
    isActive: false,
    isEmailVerified: false,
    activeSessionId: "existing-session",
    lastLoginAt: originalLastLoginAt,
    lastLoginDevice: "Existing Device",

    matchPassword: async () => {
      passwordCalls += 1;
      return false;
    },

    save: async () => {
      saveCalls += 1;
    },
  };

  try {
    User.findOne = () => ({
      select: async () => user,
    });

    const req = {
      body: {
        login: "bad-password@example.com",
        password: "WrongPassword123",
        deviceInfo: "Attacker Device",
      },
    };

    const res = makeResponse();

    await loginUser(req, res);

    assert.equal(passwordCalls, 1);
    assert.equal(saveCalls, 0);
    assert.equal(res.statusCode, 401);

    assert.deepEqual(res.body, {
      success: false,
      message: "Invalid login credentials",
    });

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body,
        "code"
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body,
        "token"
      ),
      false
    );

    assert.equal(
      user.activeSessionId,
      "existing-session"
    );

    assert.equal(
      user.lastLoginAt,
      originalLastLoginAt
    );

    assert.equal(
      user.lastLoginDevice,
      "Existing Device"
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test("loginUser returns inactive response only after valid password", async () => {
  const originalFindOne = User.findOne;

  let passwordCalls = 0;
  let saveCalls = 0;

  const originalLastLoginAt =
    new Date("2026-01-02T00:00:00.000Z");

  const user = {
    _id: "login-security-inactive",
    tenantId: "pravixoedutech",
    role: "student",
    name: "Inactive Student",
    mobile: "9876543202",
    email: "inactive@example.com",
    isActive: false,
    isEmailVerified: false,
    activeSessionId: "inactive-existing-session",
    lastLoginAt: originalLastLoginAt,
    lastLoginDevice: "Inactive Existing Device",

    matchPassword: async () => {
      passwordCalls += 1;
      return true;
    },

    save: async () => {
      saveCalls += 1;
    },
  };

  try {
    User.findOne = () => ({
      select: async () => user,
    });

    const req = {
      body: {
        login: "inactive@example.com",
        password: "StrongPass123",
        deviceInfo: "New Device",
      },
    };

    const res = makeResponse();

    await loginUser(req, res);

    assert.equal(passwordCalls, 1);
    assert.equal(saveCalls, 0);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);

    assert.equal(
      res.body.message,
      "Account is inactive"
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body,
        "code"
      ),
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body,
        "token"
      ),
      false
    );

    assert.equal(
      user.activeSessionId,
      "inactive-existing-session"
    );

    assert.equal(
      user.lastLoginAt,
      originalLastLoginAt
    );

    assert.equal(
      user.lastLoginDevice,
      "Inactive Existing Device"
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test("loginUser blocks active unverified student without session or JWT", async () => {
  const originalFindOne = User.findOne;

  let passwordCalls = 0;
  let saveCalls = 0;

  const originalLastLoginAt =
    new Date("2026-01-03T00:00:00.000Z");

  const user = {
    _id: "login-security-unverified",
    tenantId: "pravixoedutech",
    role: "student",
    name: "Unverified Student",
    mobile: "9876543203",
    email: "unverified@example.com",
    isActive: true,
    isEmailVerified: false,
    activeSessionId: "legacy-session",
    lastLoginAt: originalLastLoginAt,
    lastLoginDevice: "Legacy Device",

    matchPassword: async () => {
      passwordCalls += 1;
      return true;
    },

    save: async () => {
      saveCalls += 1;
    },
  };

  try {
    User.findOne = () => ({
      select: async () => user,
    });

    const req = {
      body: {
        login: "unverified@example.com",
        password: "StrongPass123",
        deviceInfo: "Attempted New Device",
      },
    };

    const res = makeResponse();

    await loginUser(req, res);

    assert.equal(passwordCalls, 1);
    assert.equal(saveCalls, 0);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);

    assert.equal(
      res.body.code,
      "EMAIL_VERIFICATION_REQUIRED"
    );

    assert.equal(
      res.body.message,
      "Please verify your email before signing in."
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body,
        "token"
      ),
      false
    );

    assert.equal(
      user.activeSessionId,
      "legacy-session"
    );

    assert.equal(
      user.lastLoginAt,
      originalLastLoginAt
    );

    assert.equal(
      user.lastLoginDevice,
      "Legacy Device"
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test("loginUser keeps non-student roles outside student email verification gate", async () => {
  const originalFindOne = User.findOne;
  const originalJwtSecret =
    process.env.JWT_SECRET;

  let passwordCalls = 0;
  let saveCalls = 0;

  const user = {
    _id: "login-security-admin",
    tenantId: "pravixoedutech",
    role: "tenant_admin",
    name: "Tenant Admin",
    mobile: "9876543204",
    email: "admin@example.com",
    isActive: true,
    isEmailVerified: false,
    activeSessionId: "",
    lastLoginAt: null,
    lastLoginDevice: "",

    matchPassword: async () => {
      passwordCalls += 1;
      return true;
    },

    save: async () => {
      saveCalls += 1;
    },
  };

  try {
    process.env.JWT_SECRET =
      "pravixo-admin-login-contract-secret";

    User.findOne = () => ({
      select: async () => user,
    });

    const req = {
      body: {
        login: "admin@example.com",
        password: "StrongPass123",
        deviceInfo: "  Admin Device  ",
      },
    };

    const res = makeResponse();

    await loginUser(req, res);

    assert.equal(passwordCalls, 1);
    assert.equal(saveCalls, 1);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    assert.equal(
      typeof res.body.token,
      "string"
    );

    assert.match(
      user.activeSessionId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    assert.ok(
      user.lastLoginAt instanceof Date
    );

    assert.equal(
      user.lastLoginDevice,
      "Admin Device"
    );

    const decoded = jwt.verify(
      res.body.token,
      process.env.JWT_SECRET
    );

    assert.equal(
      decoded.role,
      "tenant_admin"
    );

    assert.equal(
      decoded.sessionId,
      user.activeSessionId
    );
  } finally {
    User.findOne = originalFindOne;

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET =
        originalJwtSecret;
    }
  }
});
test("hosted registration safety gate remains closed", async () => {
  const originalNodeEnv =
    process.env.NODE_ENV;

  const originalRailwayEnvironmentName =
    process.env.RAILWAY_ENVIRONMENT_NAME;

  const originalRailwayDeploymentId =
    process.env.RAILWAY_DEPLOYMENT_ID;

  try {
    process.env.NODE_ENV = "production";

    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_DEPLOYMENT_ID;

    const req = {};

    const { res, nextCalled } =
      await runMiddleware(
        requirePublicRegistrationAvailable,
        req
      );

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);

    assert.equal(
      res.body.message,
      "Registration is currently unavailable"
    );
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV =
        originalNodeEnv;
    }

    if (
      originalRailwayEnvironmentName === undefined
    ) {
      delete process.env.RAILWAY_ENVIRONMENT_NAME;
    } else {
      process.env.RAILWAY_ENVIRONMENT_NAME =
        originalRailwayEnvironmentName;
    }

    if (
      originalRailwayDeploymentId === undefined
    ) {
      delete process.env.RAILWAY_DEPLOYMENT_ID;
    } else {
      process.env.RAILWAY_DEPLOYMENT_ID =
        originalRailwayDeploymentId;
    }
  }
});