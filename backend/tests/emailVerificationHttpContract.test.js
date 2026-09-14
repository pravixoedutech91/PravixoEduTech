const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const realServicePath =
  require.resolve(
    "../src/services/emailVerificationService"
  );

const linkServicePath =
  require.resolve(
    "../src/services/emailVerificationLinkService"
  );

const emailServicePath =
  require.resolve(
    "../src/services/emailVerificationEmailService"
  );

const controllerPath =
  require.resolve(
    "../src/controllers/authController"
  );

const actualVerificationService =
  require(
    "../src/services/emailVerificationService"
  );

const {
  EMAIL_VERIFICATION_RESULT_CODES,
} = actualVerificationService;

const originalServiceCache =
  require.cache[realServicePath];

const originalLinkCache =
  require.cache[linkServicePath];

const originalEmailCache =
  require.cache[emailServicePath];

const originalControllerCache =
  require.cache[controllerPath];

let requestImpl =
  async () => ({
    success: true,
    code:
      EMAIL_VERIFICATION_RESULT_CODES.ISSUED,
  });

let verifyImpl =
  async () => ({
    success: true,
    code:
      EMAIL_VERIFICATION_RESULT_CODES.VERIFIED,
  });

let linkCalls = [];
let emailCalls = [];

const cacheModule =
  (filename, exports) => {
    require.cache[filename] = {
      id: filename,
      filename,
      loaded: true,
      exports,
      children: [],
      paths: [],
    };
  };

cacheModule(
  realServicePath,
  {
    EMAIL_VERIFICATION_RESULT_CODES,

    issueStudentEmailVerification:
      async () => ({
        success: true,
        code:
          EMAIL_VERIFICATION_RESULT_CODES.ISSUED,
      }),

    requestStudentEmailVerification:
      (...args) =>
        requestImpl(
          ...args
        ),

    verifyStudentEmail:
      (...args) =>
        verifyImpl(
          ...args
        ),
  }
);

cacheModule(
  linkServicePath,
  {
    buildStudentEmailVerificationUrl:
      ({ rawToken }) => {
        linkCalls.push(
          rawToken
        );

        return (
          "https://example.test/student/verify-email#token=" +
          encodeURIComponent(
            rawToken
          )
        );
      },
  }
);

cacheModule(
  emailServicePath,
  {
    sendEmailVerificationEmail:
      async (payload) => {
        emailCalls.push(
          payload
        );

        return {
          success: true,
        };
      },
  }
);

delete require.cache[controllerPath];

const {
  resendEmailVerification,
  verifyEmail,
} = require(
  controllerPath
);

const makeResponse =
  () => ({
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

const runHandler =
  async (
    handler,
    body
  ) => {
    const req = {
      body,
    };

    const res =
      makeResponse();

    await handler(
      req,
      res
    );

    return res;
  };

const genericResendBody = {
  success: true,
  message:
    "If an eligible account exists, email verification instructions have been sent.",
};

const verifySuccessBody = {
  success: true,
  message:
    "Email verified successfully. Please sign in.",
};

const invalidVerifyBody = {
  success: false,
  message:
    "This email verification link is invalid or has expired. Please request a new one.",
};

test.after(() => {
  if (originalServiceCache) {
    require.cache[realServicePath] =
      originalServiceCache;
  } else {
    delete require.cache[realServicePath];
  }

  if (originalLinkCache) {
    require.cache[linkServicePath] =
      originalLinkCache;
  } else {
    delete require.cache[linkServicePath];
  }

  if (originalEmailCache) {
    require.cache[emailServicePath] =
      originalEmailCache;
  } else {
    delete require.cache[emailServicePath];
  }

  if (originalControllerCache) {
    require.cache[controllerPath] =
      originalControllerCache;
  } else {
    delete require.cache[controllerPath];
  }
});

test("email verification routes are public and exactly limiter then controller", () => {
  const source =
    fs
      .readFileSync(
        "./src/routes/authRoutes.js",
        "utf8"
      )
      .replace(
        /\r\n/g,
        "\n"
      );

  const resendBlock = [
    "router.post(",
    '  "/resend-email-verification",',
    "  resendEmailVerificationRateLimiter,",
    "  resendEmailVerification",
    ");",
  ].join(
    "\n"
  );

  const verifyBlock = [
    "router.post(",
    '  "/verify-email",',
    "  verifyEmailVerificationRateLimiter,",
    "  verifyEmail",
    ");",
  ].join(
    "\n"
  );

  assert.equal(
    source.split(
      resendBlock
    ).length - 1,
    1
  );

  assert.equal(
    source.split(
      verifyBlock
    ).length - 1,
    1
  );

  for (
    const block of [
      resendBlock,
      verifyBlock,
    ]
  ) {
    assert.equal(
      block.includes(
        "protect"
      ),
      false
    );

    assert.equal(
      block.includes(
        "requirePublicRegistrationAvailable"
      ),
      false
    );

    assert.equal(
      block.includes(
        "resolvePublicRegistrationTenant"
      ),
      false
    );
  }
});

test("eligible resend uses trusted link and email boundary but exposes only generic 200", async () => {
  requestImpl =
    async ({
      login,
      deliverVerification,
    }) => {
      assert.equal(
        login,
        "student@example.com"
      );

      await deliverVerification({
        toEmail:
          "student@example.com",
        rawToken:
          "permanent-http-token",
        expiresAt:
          new Date(
            "2030-01-01T00:00:00.000Z"
          ),
      });

      return {
        success: true,
        code:
          EMAIL_VERIFICATION_RESULT_CODES.ISSUED,
      };
    };

  linkCalls = [];
  emailCalls = [];

  const res =
    await runHandler(
      resendEmailVerification,
      {
        login:
          "student@example.com",
      }
    );

  assert.equal(
    res.statusCode,
    200
  );

  assert.deepEqual(
    res.body,
    genericResendBody
  );

  assert.deepEqual(
    linkCalls,
    [
      "permanent-http-token",
    ]
  );

  assert.equal(
    emailCalls.length,
    1
  );

  assert.equal(
    emailCalls[0].toEmail,
    "student@example.com"
  );

  assert.equal(
    emailCalls[0].verificationUrl,
    "https://example.test/student/verify-email#token=permanent-http-token"
  );
});

test("ineligible cooldown and resend failures remain publicly indistinguishable", async () => {
  for (
    const code of [
      EMAIL_VERIFICATION_RESULT_CODES.INELIGIBLE,
      EMAIL_VERIFICATION_RESULT_CODES.COOLDOWN,
    ]
  ) {
    requestImpl =
      async () => ({
        success: false,
        code,
      });

    const res =
      await runHandler(
        resendEmailVerification,
        {
          login:
            "unknown@example.com",
        }
      );

    assert.equal(
      res.statusCode,
      200
    );

    assert.deepEqual(
      res.body,
      genericResendBody
    );
  }

  requestImpl =
    async () => {
      throw new Error(
        "permanent-http-resend-failure"
      );
    };

  const failure =
    await runHandler(
      resendEmailVerification,
      {
        login:
          "student@example.com",
      }
    );

  assert.equal(
    failure.statusCode,
    200
  );

  assert.deepEqual(
    failure.body,
    genericResendBody
  );
});

test("VERIFIED maps to success without JWT or session material", async () => {
  verifyImpl =
    async ({ rawToken }) => {
      assert.equal(
        rawToken,
        "verified-token"
      );

      return {
        success: true,
        code:
          EMAIL_VERIFICATION_RESULT_CODES.VERIFIED,
      };
    };

  const res =
    await runHandler(
      verifyEmail,
      {
        token:
          "verified-token",
      }
    );

  assert.equal(
    res.statusCode,
    200
  );

  assert.deepEqual(
    res.body,
    verifySuccessBody
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      res.body,
      "token"
    ),
    false
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      res.body,
      "data"
    ),
    false
  );
});

test("ALREADY_VERIFIED maps to the same public success response", async () => {
  verifyImpl =
    async () => ({
      success: true,
      code:
        EMAIL_VERIFICATION_RESULT_CODES.ALREADY_VERIFIED,
    });

  const res =
    await runHandler(
      verifyEmail,
      {
        token:
          "already-verified-token",
      }
    );

  assert.equal(
    res.statusCode,
    200
  );

  assert.deepEqual(
    res.body,
    verifySuccessBody
  );
});

test("invalid or expired verification credential maps to generic 400", async () => {
  verifyImpl =
    async () => ({
      success: false,
      code:
        EMAIL_VERIFICATION_RESULT_CODES.INVALID_OR_EXPIRED_TOKEN,
    });

  const res =
    await runHandler(
      verifyEmail,
      {
        token:
          "invalid-token",
      }
    );

  assert.equal(
    res.statusCode,
    400
  );

  assert.deepEqual(
    res.body,
    invalidVerifyBody
  );
});
