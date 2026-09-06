const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const http =
  require("node:http");

const express =
  require("express");

const {
  generateEmailVerificationToken,
} = require(
  "../src/utils/emailVerificationSecurity"
);

const {
  EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV,
  LOCAL_EMAIL_VERIFICATION_FRONTEND_ORIGIN,
  STUDENT_EMAIL_VERIFICATION_PATH,
  EmailVerificationLinkError,
  normalizeEmailVerificationFrontendOrigin,
  getEmailVerificationFrontendOrigin,
  buildStudentEmailVerificationUrl,
} = require(
  "../src/services/emailVerificationLinkService"
);

const {
  EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MS,
  EMAIL_VERIFICATION_RESEND_MAX_REQUESTS,
  EMAIL_VERIFICATION_VERIFY_MAX_REQUESTS,
  normalizeIpAddress,
  getFirstForwardedIp,
  getEmailVerificationRateLimitClientIp,
  resendEmailVerificationRateLimiter,
  verifyEmailVerificationRateLimiter,
} = require(
  "../src/middleware/emailVerificationRateLimitMiddleware"
);

const {
  POSTMARK_EMAIL_ENDPOINT,
  POSTMARK_REQUEST_TIMEOUT_MS,
  DEFAULT_POSTMARK_MESSAGE_STREAM,
  EMAIL_VERIFICATION_EMAIL_SUBJECT,
  EMAIL_VERIFICATION_EMAIL_TAG,
  EmailVerificationEmailDeliveryError,
  normalizeTrustedVerificationUrl,
  buildEmailVerificationMessage,
  sendEmailVerificationEmail,
} = require(
  "../src/services/emailVerificationEmailService"
);

const passwordResetEmail =
  require(
    "../src/services/passwordResetEmailService"
  );

const saveEnvironment =
  () => ({
    nodeEnv:
      process.env.NODE_ENV,

    railwayEnvironment:
      process.env
        .RAILWAY_ENVIRONMENT_NAME,

    railwayDeployment:
      process.env
        .RAILWAY_DEPLOYMENT_ID,

    verificationOrigin:
      process.env[
        EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV
      ],
  });

const restoreEnvironment =
  (snapshot) => {
    const restore = (
      key,
      value
    ) => {
      if (
        value === undefined
      ) {
        delete process.env[key];
      } else {
        process.env[key] =
          value;
      }
    };

    restore(
      "NODE_ENV",
      snapshot.nodeEnv
    );

    restore(
      "RAILWAY_ENVIRONMENT_NAME",
      snapshot.railwayEnvironment
    );

    restore(
      "RAILWAY_DEPLOYMENT_ID",
      snapshot.railwayDeployment
    );

    restore(
      EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV,
      snapshot.verificationOrigin
    );
  };

const configureTrustedTestOrigin =
  () => {
    process.env.NODE_ENV =
      "development";

    delete process.env
      .RAILWAY_ENVIRONMENT_NAME;

    delete process.env
      .RAILWAY_DEPLOYMENT_ID;

    process.env[
      EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV
    ] =
      "https://student.example.com";
  };

test(
  "verification link uses exact trusted origin, route and fragment-only credential",
  () => {
    const environment =
      saveEnvironment();

    try {
      configureTrustedTestOrigin();

      const rawToken =
        generateEmailVerificationToken();

      const verificationUrl =
        buildStudentEmailVerificationUrl({
          rawToken,
        });

      const parsed =
        new URL(
          verificationUrl
        );

      assert.equal(
        EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV,
        "EMAIL_VERIFICATION_FRONTEND_ORIGIN"
      );

      assert.equal(
        LOCAL_EMAIL_VERIFICATION_FRONTEND_ORIGIN,
        "http://localhost:3000"
      );

      assert.equal(
        STUDENT_EMAIL_VERIFICATION_PATH,
        "/student/verify-email"
      );

      assert.equal(
        parsed.origin,
        "https://student.example.com"
      );

      assert.equal(
        parsed.pathname,
        "/student/verify-email"
      );

      assert.equal(
        parsed.search,
        ""
      );

      assert.equal(
        parsed.hash,
        "#token=" +
          rawToken
      );

      assert.equal(
        parsed.searchParams.has(
          "token"
        ),
        false
      );

      assert.equal(
        verificationUrl.includes(
          "?token="
        ),
        false
      );

      assert.equal(
        normalizeTrustedVerificationUrl(
          verificationUrl
        ),
        verificationUrl
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "verification origin policy allows local HTTP only outside hosted runtime",
  () => {
    assert.equal(
      normalizeEmailVerificationFrontendOrigin(
        "http://localhost:3000",
        {
          hosted: false,
        }
      ),
      "http://localhost:3000"
    );

    assert.equal(
      normalizeEmailVerificationFrontendOrigin(
        "http://example.com",
        {
          hosted: false,
        }
      ),
      ""
    );

    assert.equal(
      normalizeEmailVerificationFrontendOrigin(
        "https://student.example.com",
        {
          hosted: true,
        }
      ),
      "https://student.example.com"
    );

    assert.equal(
      normalizeEmailVerificationFrontendOrigin(
        "http://localhost:3000",
        {
          hosted: true,
        }
      ),
      ""
    );

    assert.equal(
      normalizeEmailVerificationFrontendOrigin(
        "https://localhost",
        {
          hosted: true,
        }
      ),
      ""
    );

    assert.equal(
      normalizeEmailVerificationFrontendOrigin(
        "https://student.example.com/path",
        {
          hosted: true,
        }
      ),
      ""
    );
  }
);

test(
  "hosted verification-link configuration fails closed without trusted origin",
  () => {
    const environment =
      saveEnvironment();

    try {
      process.env.NODE_ENV =
        "production";

      delete process.env
        .RAILWAY_ENVIRONMENT_NAME;

      delete process.env
        .RAILWAY_DEPLOYMENT_ID;

      delete process.env[
        EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV
      ];

      assert.throws(
        () =>
          getEmailVerificationFrontendOrigin(),
        (error) =>
          error instanceof
            EmailVerificationLinkError &&
          error.type ===
            "email_verification_origin_configuration_error"
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "verification rate limiter constants and IP normalization remain locked",
  () => {
    assert.equal(
      EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    );

    assert.equal(
      EMAIL_VERIFICATION_RESEND_MAX_REQUESTS,
      20
    );

    assert.equal(
      EMAIL_VERIFICATION_VERIFY_MAX_REQUESTS,
      60
    );

    assert.notEqual(
      resendEmailVerificationRateLimiter,
      verifyEmailVerificationRateLimiter
    );

    assert.equal(
      normalizeIpAddress(
        "::ffff:127.0.0.1"
      ),
      "127.0.0.1"
    );

    assert.equal(
      normalizeIpAddress(
        "2001:db8::1"
      ),
      "2001:db8::1"
    );

    assert.equal(
      normalizeIpAddress(
        "invalid-ip"
      ),
      ""
    );

    assert.equal(
      getFirstForwardedIp(
        "203.0.113.7, 10.0.0.4"
      ),
      "203.0.113.7"
    );
  }
);

test(
  "verification limiter never derives identity from public body data",
  () => {
    const environment =
      saveEnvironment();

    try {
      delete process.env
        .RAILWAY_ENVIRONMENT_NAME;

      delete process.env
        .RAILWAY_DEPLOYMENT_ID;

      const first =
        getEmailVerificationRateLimitClientIp({
          headers: {},

          ip:
            "198.51.100.25",

          socket: {},

          body: {
            login:
              "first@example.com",

            token:
              "first",
          },
        });

      const second =
        getEmailVerificationRateLimitClientIp({
          headers: {},

          ip:
            "198.51.100.25",

          socket: {},

          body: {
            login:
              "second@example.com",

            token:
              "second",
          },
        });

      assert.equal(
        first,
        "198.51.100.25"
      );

      assert.equal(
        second,
        first
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "forwarded verification limiter identity is trusted only in Railway runtime",
  () => {
    const environment =
      saveEnvironment();

    const request = {
      headers: {
        "x-forwarded-for":
          "203.0.113.15, 10.0.0.4",

        "x-real-ip":
          "203.0.113.16",
      },

      ip:
        "10.0.0.5",

      socket: {
        remoteAddress:
          "10.0.0.6",
      },
    };

    try {
      delete process.env
        .RAILWAY_ENVIRONMENT_NAME;

      delete process.env
        .RAILWAY_DEPLOYMENT_ID;

      assert.equal(
        getEmailVerificationRateLimitClientIp(
          request
        ),
        "10.0.0.5"
      );

      process.env
        .RAILWAY_ENVIRONMENT_NAME =
          "production";

      assert.equal(
        getEmailVerificationRateLimitClientIp(
          request
        ),
        "203.0.113.15"
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "verification email message is trusted, transactional and tracking-free",
  () => {
    const environment =
      saveEnvironment();

    try {
      configureTrustedTestOrigin();

      const rawToken =
        generateEmailVerificationToken();

      const verificationUrl =
        buildStudentEmailVerificationUrl({
          rawToken,
        });

      const expiresAt =
        new Date(
          "2030-01-02T03:04:05.000Z"
        );

      const message =
        buildEmailVerificationMessage({
          toEmail:
            " Student@Example.com ",

          verificationUrl,

          expiresAt,

          configuration: {
            fromEmail:
              "security@pravixo.example",

            messageStream:
              "outbound",
          },
        });

      assert.equal(
        POSTMARK_EMAIL_ENDPOINT,
        passwordResetEmail
          .POSTMARK_EMAIL_ENDPOINT
      );

      assert.equal(
        POSTMARK_REQUEST_TIMEOUT_MS,
        passwordResetEmail
          .POSTMARK_REQUEST_TIMEOUT_MS
      );

      assert.equal(
        DEFAULT_POSTMARK_MESSAGE_STREAM,
        passwordResetEmail
          .DEFAULT_POSTMARK_MESSAGE_STREAM
      );

      assert.equal(
        EMAIL_VERIFICATION_EMAIL_SUBJECT,
        "Verify your PravixoEduTech email"
      );

      assert.equal(
        EMAIL_VERIFICATION_EMAIL_TAG,
        "email-verification"
      );

      assert.equal(
        message.To,
        "student@example.com"
      );

      assert.equal(
        message.From,
        "PravixoEduTech <security@pravixo.example>"
      );

      assert.equal(
        message.Tag,
        "email-verification"
      );

      assert.equal(
        message.TrackOpens,
        false
      );

      assert.equal(
        message.TrackLinks,
        "None"
      );

      assert.equal(
        message.TextBody.includes(
          verificationUrl
        ),
        true
      );

      assert.equal(
        message.HtmlBody.includes(
          verificationUrl.replaceAll(
            "&",
            "&amp;"
          )
        ),
        true
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "verification email rejects untrusted credential-bearing URLs",
  () => {
    const environment =
      saveEnvironment();

    try {
      configureTrustedTestOrigin();

      const rawToken =
        generateEmailVerificationToken();

      assert.equal(
        normalizeTrustedVerificationUrl(
          "https://attacker.example.com/student/verify-email#token=" +
            rawToken
        ),
        ""
      );

      assert.equal(
        normalizeTrustedVerificationUrl(
          "https://student.example.com/wrong#token=" +
            rawToken
        ),
        ""
      );

      assert.equal(
        normalizeTrustedVerificationUrl(
          "https://student.example.com/student/verify-email?token=" +
            rawToken
        ),
        ""
      );

      assert.equal(
        normalizeTrustedVerificationUrl(
          "https://student.example.com/student/verify-email#token=bad"
        ),
        ""
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "verification Postmark adapter confines credential and sanitizes successful result",
  async () => {
    const environment =
      saveEnvironment();

    try {
      configureTrustedTestOrigin();

      const rawToken =
        generateEmailVerificationToken();

      const verificationUrl =
        buildStudentEmailVerificationUrl({
          rawToken,
        });

      let captured =
        null;

      const result =
        await sendEmailVerificationEmail({
          toEmail:
            "student@example.com",

          verificationUrl,

          expiresAt:
            new Date(
              Date.now() +
                24 *
                  60 *
                  60 *
                  1000
            ),

          env: {
            POSTMARK_SERVER_TOKEN:
              "postmark-contract-token",

            POSTMARK_FROM_EMAIL:
              "security@pravixo.example",

            POSTMARK_MESSAGE_STREAM:
              "outbound",
          },

          fetchImpl:
            async (
              url,
              options
            ) => {
              captured = {
                url,
                options,
              };

              return {
                ok:
                  true,

                status:
                  200,

                json:
                  async () => ({
                    ErrorCode:
                      0,

                    Message:
                      "OK",

                    MessageID:
                      " contract-message-id ",
                  }),
              };
            },
        });

      assert.deepEqual(
        result,
        {
          messageId:
            "contract-message-id",
        }
      );

      assert.equal(
        captured.url,
        "https://api.postmarkapp.com/email"
      );

      assert.equal(
        captured.options.method,
        "POST"
      );

      assert.equal(
        captured.options.redirect,
        "error"
      );

      assert.equal(
        captured.options.headers[
          "X-Postmark-Server-Token"
        ],
        "postmark-contract-token"
      );

      assert.ok(
        captured.options.signal
      );

      const message =
        JSON.parse(
          captured.options.body
        );

      assert.equal(
        message.TrackOpens,
        false
      );

      assert.equal(
        message.TrackLinks,
        "None"
      );

      assert.equal(
        message.TextBody.includes(
          verificationUrl
        ),
        true
      );

      const resultJson =
        JSON.stringify(
          result
        );

      assert.equal(
        resultJson.includes(
          verificationUrl
        ),
        false
      );

      assert.equal(
        resultJson.includes(
          "student@example.com"
        ),
        false
      );

      assert.equal(
        resultJson.includes(
          "postmark-contract-token"
        ),
        false
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "verification Postmark adapter fails before transport when configuration is absent",
  async () => {
    const environment =
      saveEnvironment();

    try {
      configureTrustedTestOrigin();

      const rawToken =
        generateEmailVerificationToken();

      const verificationUrl =
        buildStudentEmailVerificationUrl({
          rawToken,
        });

      let fetchCalls =
        0;

      await assert.rejects(
        sendEmailVerificationEmail({
          toEmail:
            "student@example.com",

          verificationUrl,

          expiresAt:
            new Date(
              Date.now() +
                60_000
            ),

          env: {},

          fetchImpl:
            async () => {
              fetchCalls +=
                1;

              throw new Error(
                "must not execute"
              );
            },
        }),
        (error) =>
          error instanceof
            EmailVerificationEmailDeliveryError &&
          error.type ===
            "email_verification_email_configuration_error"
      );

      assert.equal(
        fetchCalls,
        0
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "verification Postmark provider failures expose no provider response detail",
  async () => {
    const environment =
      saveEnvironment();

    try {
      configureTrustedTestOrigin();

      const rawToken =
        generateEmailVerificationToken();

      const verificationUrl =
        buildStudentEmailVerificationUrl({
          rawToken,
        });

      const fakeEnv = {
        POSTMARK_SERVER_TOKEN:
          "postmark-contract-token",

        POSTMARK_FROM_EMAIL:
          "security@pravixo.example",

        POSTMARK_MESSAGE_STREAM:
          "outbound",
      };

      await assert.rejects(
        sendEmailVerificationEmail({
          toEmail:
            "student@example.com",

          verificationUrl,

          expiresAt:
            new Date(
              Date.now() +
                60_000
            ),

          env:
            fakeEnv,

          fetchImpl:
            async () => ({
              ok:
                false,

              status:
                422,

              json:
                async () => ({
                  ErrorCode:
                    300,

                  Message:
                    "sensitive provider detail",
                }),
            }),
        }),
        (error) =>
          error instanceof
            EmailVerificationEmailDeliveryError &&
          error.type ===
            "email_verification_email_provider_error" &&
          error.statusCode ===
            422 &&
          !error.message.includes(
            "sensitive provider detail"
          )
      );
    } finally {
      restoreEnvironment(
        environment
      );
    }
  }
);

test(
  "verification resend and verify limiters enforce independent successful-request budgets",
  async () => {
    /*
     * This test is intentionally the only test that exhausts
     * these module-level in-memory limiter instances.
     */
    const app =
      express();

    app.post(
      "/resend",
      resendEmailVerificationRateLimiter,
      (req, res) => {
        res.status(
          204
        ).end();
      }
    );

    app.post(
      "/verify",
      verifyEmailVerificationRateLimiter,
      (req, res) => {
        res.status(
          204
        ).end();
      }
    );

    const server =
      http.createServer(
        app
      );

    const listen =
      () =>
        new Promise(
          (
            resolve,
            reject
          ) => {
            const onError =
              (error) => {
                reject(
                  error
                );
              };

            server.once(
              "error",
              onError
            );

            server.listen(
              0,
              "127.0.0.1",
              () => {
                server.removeListener(
                  "error",
                  onError
                );

                resolve();
              }
            );
          }
        );

    const close =
      () =>
        new Promise(
          (
            resolve,
            reject
          ) => {
            server.close(
              (error) => {
                if (error) {
                  reject(
                    error
                  );
                  return;
                }

                resolve();
              }
            );
          }
        );

    const request =
      (path) =>
        new Promise(
          (
            resolve,
            reject
          ) => {
            const address =
              server.address();

            const req =
              http.request(
                {
                  hostname:
                    "127.0.0.1",

                  port:
                    address.port,

                  path,

                  method:
                    "POST",
                },
                (res) => {
                  const chunks =
                    [];

                  res.on(
                    "data",
                    (chunk) => {
                      chunks.push(
                        chunk
                      );
                    }
                  );

                  res.once(
                    "end",
                    () => {
                      resolve({
                        statusCode:
                          res.statusCode,

                        body:
                          Buffer.concat(
                            chunks
                          ).toString(
                            "utf8"
                          ),
                      });
                    }
                  );
                }
              );

            req.once(
              "error",
              reject
            );

            req.end();
          }
        );

    await listen();

    try {
      for (
        let index = 0;
        index <
          EMAIL_VERIFICATION_RESEND_MAX_REQUESTS;
        index += 1
      ) {
        const response =
          await request(
            "/resend"
          );

        assert.equal(
          response.statusCode,
          204
        );
      }

      const blockedResend =
        await request(
          "/resend"
        );

      assert.equal(
        blockedResend.statusCode,
        429
      );

      assert.match(
        blockedResend.body,
        /Too many verification email requests/i
      );

      for (
        let index = 0;
        index <
          EMAIL_VERIFICATION_VERIFY_MAX_REQUESTS;
        index += 1
      ) {
        const response =
          await request(
            "/verify"
          );

        assert.equal(
          response.statusCode,
          204
        );
      }

      const blockedVerify =
        await request(
          "/verify"
        );

      assert.equal(
        blockedVerify.statusCode,
        429
      );

      assert.match(
        blockedVerify.body,
        /Too many email verification attempts/i
      );
    } finally {
      await close();
    }
  }
);
