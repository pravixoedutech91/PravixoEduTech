const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RESEND_EMAIL_ENDPOINT,
  RESEND_REQUEST_TIMEOUT_MS,
  TransactionalEmailDeliveryError,
  normalizeEmailProvider,
  normalizeEmailAddress,
  normalizeResendApiKey,
  normalizeIdempotencyKey,
  buildCredentialSafeIdempotencyKey,
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
} = require(
  "../src/services/transactionalEmailTransportService"
);

const makeValidEnv = () => ({
  EMAIL_PROVIDER: "resend",
  EMAIL_FROM:
    "support@pravixoedutech.in",
  RESEND_API_KEY:
    "re_contract_test_only",
});

const assertDeliveryError =
  (
    expectedType,
    expectedStatusCode
  ) =>
  (error) => {
    assert.ok(
      error instanceof
        TransactionalEmailDeliveryError
    );

    assert.equal(
      error.name,
      "TransactionalEmailDeliveryError"
    );

    assert.equal(
      error.message,
      "Transactional email delivery is unavailable"
    );

    assert.equal(
      error.type,
      expectedType
    );

    if (
      expectedStatusCode ===
      undefined
    ) {
      assert.equal(
        Object.hasOwn(
          error,
          "statusCode"
        ),
        false
      );
    } else {
      assert.equal(
        error.statusCode,
        expectedStatusCode
      );
    }

    const publicErrorShape =
      JSON.stringify({
        name: error.name,
        message: error.message,
        type: error.type,
        statusCode:
          error.statusCode,
      });

    assert.equal(
      publicErrorShape.includes(
        "re_contract_test_only"
      ),
      false
    );

    return true;
  };


test(
  "transport constants and provider boundary remain locked",
  () => {
    assert.equal(
      RESEND_EMAIL_ENDPOINT,
      "https://api.resend.com/emails"
    );

    assert.equal(
      RESEND_REQUEST_TIMEOUT_MS,
      10000
    );

    assert.equal(
      normalizeEmailProvider(
        " RESEND "
      ),
      "resend"
    );

    assert.equal(
      normalizeEmailProvider(
        "postmark"
      ),
      ""
    );

    assert.equal(
      normalizeEmailProvider(
        "brevo"
      ),
      ""
    );

    assert.equal(
      normalizeEmailProvider(""),
      ""
    );
  }
);


test(
  "email and API-key normalization fail closed",
  () => {
    assert.equal(
      normalizeEmailAddress(
        " Student@Example.COM "
      ),
      "student@example.com"
    );

    assert.equal(
      normalizeEmailAddress(
        "student@example.com\r\nBcc: attacker@example.com"
      ),
      ""
    );

    assert.equal(
      normalizeEmailAddress(
        "not-an-email"
      ),
      ""
    );

    assert.equal(
      normalizeEmailAddress(
        "student@example"
      ),
      ""
    );

    assert.equal(
      normalizeEmailAddress(
        "a@@example.com"
      ),
      ""
    );

    assert.equal(
      normalizeResendApiKey(
        " re_test_key "
      ),
      "re_test_key"
    );

    assert.equal(
      normalizeResendApiKey(
        "postmark-key"
      ),
      ""
    );

    assert.equal(
      normalizeResendApiKey(
        "re_bad key"
      ),
      ""
    );

    assert.equal(
      normalizeResendApiKey(""),
      ""
    );
  }
);


test(
  "configuration requires explicit supported provider, sender and Resend key",
  () => {
    assert.deepEqual(
      getTransactionalEmailConfiguration(
        makeValidEnv()
      ),
      {
        provider: "resend",
        fromEmail:
          "support@pravixoedutech.in",
        apiKey:
          "re_contract_test_only",
      }
    );

    assert.throws(
      () =>
        getTransactionalEmailConfiguration({
          EMAIL_FROM:
            "support@pravixoedutech.in",
          RESEND_API_KEY:
            "re_contract_test_only",
        }),
      assertDeliveryError(
        "transactional_email_configuration_error"
      )
    );

    assert.throws(
      () =>
        getTransactionalEmailConfiguration({
          EMAIL_PROVIDER:
            "resend",
          RESEND_API_KEY:
            "re_contract_test_only",
        }),
      assertDeliveryError(
        "transactional_email_configuration_error"
      )
    );

    assert.throws(
      () =>
        getTransactionalEmailConfiguration({
          EMAIL_PROVIDER:
            "resend",
          EMAIL_FROM:
            "support@pravixoedutech.in",
        }),
      assertDeliveryError(
        "transactional_email_configuration_error"
      )
    );

    assert.throws(
      () =>
        getTransactionalEmailConfiguration({
          EMAIL_PROVIDER:
            "brevo",
          EMAIL_FROM:
            "support@pravixoedutech.in",
          BREVO_API_KEY:
            "standby-not-active",
        }),
      assertDeliveryError(
        "transactional_email_configuration_error"
      )
    );
  }
);


test(
  "credential-safe idempotency keys are deterministic and contain no raw credential",
  () => {
    const credentialUrl =
      "https://pravixoedutech.in/student/verify-email#token=super-secret-verification-token";

    const first =
      buildCredentialSafeIdempotencyKey({
        purpose:
          "email-verification",
        credentialUrl,
      });

    const second =
      buildCredentialSafeIdempotencyKey({
        purpose:
          "email-verification",
        credentialUrl,
      });

    const changed =
      buildCredentialSafeIdempotencyKey({
        purpose:
          "email-verification",
        credentialUrl:
          credentialUrl + "-changed",
      });

    assert.match(
      first,
      /^email-verification\/[a-f0-9]{64}$/
    );

    assert.equal(
      first,
      second
    );

    assert.notEqual(
      first,
      changed
    );

    assert.equal(
      first.includes(
        credentialUrl
      ),
      false
    );

    assert.equal(
      first.includes(
        "super-secret-verification-token"
      ),
      false
    );

    assert.equal(
      normalizeIdempotencyKey(
        first
      ),
      first
    );
  }
);


test(
  "successful Resend request confines API credential and preserves multiline bodies",
  async () => {
    let callCount = 0;
    let capturedUrl;
    let capturedOptions;

    const fakeFetch =
      async (
        url,
        options
      ) => {
        callCount += 1;
        capturedUrl = url;
        capturedOptions =
          options;

        return {
          status: 200,

          async json() {
            return {
              id:
                "resend-message-123",
            };
          },
        };
      };

    const result =
      await sendTransactionalEmail({
        toEmail:
          " Student@Example.COM ",
        subject:
          "Verify your PravixoEduTech email",
        textBody:
          "Line one\nLine two\r\nLine three\tTabbed",
        htmlBody:
          "<p>Verify your account</p>\n<p>Secure link</p>",
        idempotencyKey:
          "email-verification/0123456789abcdef",
        fetchImpl:
          fakeFetch,
        env:
          makeValidEnv(),
      });

    assert.equal(
      callCount,
      1
    );

    assert.equal(
      capturedUrl,
      RESEND_EMAIL_ENDPOINT
    );

    assert.equal(
      capturedOptions.method,
      "POST"
    );

    assert.equal(
      capturedOptions.redirect,
      "error"
    );

    assert.equal(
      capturedOptions.headers.Accept,
      "application/json"
    );

    assert.equal(
      capturedOptions.headers[
        "Content-Type"
      ],
      "application/json"
    );

    assert.equal(
      capturedOptions.headers.Authorization,
      "Bearer re_contract_test_only"
    );

    assert.equal(
      capturedOptions.headers[
        "Idempotency-Key"
      ],
      "email-verification/0123456789abcdef"
    );

    const payload =
      JSON.parse(
        capturedOptions.body
      );

    assert.deepEqual(
      payload.to,
      [
        "student@example.com",
      ]
    );

    assert.equal(
      payload.from,
      "support@pravixoedutech.in"
    );

    assert.equal(
      payload.subject,
      "Verify your PravixoEduTech email"
    );

    assert.equal(
      payload.text,
      "Line one\nLine two\r\nLine three\tTabbed"
    );

    assert.equal(
      payload.html,
      "<p>Verify your account</p>\n<p>Secure link</p>"
    );

    assert.equal(
      Object.hasOwn(
        payload,
        "apiKey"
      ),
      false
    );

    assert.equal(
      JSON.stringify(
        payload
      ).includes(
        "re_contract_test_only"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        payload,
        "MessageStream"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        payload,
        "TrackLinks"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        payload,
        "TrackOpens"
      ),
      false
    );

    assert.deepEqual(
      result,
      {
        provider:
          "resend",
        messageId:
          "resend-message-123",
      }
    );

    const serializedResult =
      JSON.stringify(result);

    assert.equal(
      serializedResult.includes(
        "student@example.com"
      ),
      false
    );

    assert.equal(
      serializedResult.includes(
        "re_contract_test_only"
      ),
      false
    );

    assert.equal(
      serializedResult.includes(
        "Verify your PravixoEduTech email"
      ),
      false
    );
  }
);


test(
  "invalid public input fails before transport",
  async () => {
    let callCount = 0;

    const fakeFetch =
      async () => {
        callCount += 1;

        throw new Error(
          "transport must not run"
        );
      };

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com\r\nBcc:attacker@example.com",
        subject:
          "Safe subject",
        textBody:
          "Valid body",
        fetchImpl:
          fakeFetch,
        env:
          makeValidEnv(),
      }),
      assertDeliveryError(
        "transactional_email_input_error"
      )
    );

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com",
        subject:
          "Unsafe\r\nSubject",
        textBody:
          "Valid body",
        fetchImpl:
          fakeFetch,
        env:
          makeValidEnv(),
      }),
      assertDeliveryError(
        "transactional_email_input_error"
      )
    );

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com",
        subject:
          "Safe subject",
        textBody:
          "Unsafe\u0000body",
        fetchImpl:
          fakeFetch,
        env:
          makeValidEnv(),
      }),
      assertDeliveryError(
        "transactional_email_input_error"
      )
    );

    assert.equal(
      callCount,
      0
    );
  }
);


test(
  "missing or unsupported configuration fails before transport",
  async () => {
    let callCount = 0;

    const fakeFetch =
      async () => {
        callCount += 1;

        throw new Error(
          "transport must not run"
        );
      };

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com",
        subject:
          "Verification",
        textBody:
          "Valid body",
        fetchImpl:
          fakeFetch,
        env: {
          EMAIL_PROVIDER:
            "resend",
          EMAIL_FROM:
            "support@pravixoedutech.in",
        },
      }),
      assertDeliveryError(
        "transactional_email_configuration_error"
      )
    );

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com",
        subject:
          "Verification",
        textBody:
          "Valid body",
        fetchImpl:
          fakeFetch,
        env: {
          EMAIL_PROVIDER:
            "brevo",
          EMAIL_FROM:
            "support@pravixoedutech.in",
          BREVO_API_KEY:
            "standby-only",
        },
      }),
      assertDeliveryError(
        "transactional_email_configuration_error"
      )
    );

    assert.equal(
      callCount,
      0
    );
  }
);


test(
  "transport exceptions expose no underlying provider or credential detail",
  async () => {
    const fakeFetch =
      async () => {
        throw new Error(
          "network error containing re_contract_test_only and provider internals"
        );
      };

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com",
        subject:
          "Verification",
        textBody:
          "Valid body",
        fetchImpl:
          fakeFetch,
        env:
          makeValidEnv(),
      }),
      (error) => {
        assertDeliveryError(
          "transactional_email_transport_error"
        )(error);

        assert.equal(
          error.message.includes(
            "network"
          ),
          false
        );

        assert.equal(
          error.message.includes(
            "re_contract_test_only"
          ),
          false
        );

        return true;
      }
    );
  }
);


test(
  "provider rejection exposes only sanitized type and status",
  async () => {
    const fakeFetch =
      async () => ({
        status: 429,

        async json() {
          throw new Error(
            "provider body must not be parsed"
          );
        },
      });

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com",
        subject:
          "Verification",
        textBody:
          "Valid body",
        fetchImpl:
          fakeFetch,
        env:
          makeValidEnv(),
      }),
      assertDeliveryError(
        "transactional_email_provider_error",
        429
      )
    );
  }
);


test(
  "malformed successful provider response is sanitized",
  async () => {
    const malformedJsonFetch =
      async () => ({
        status: 200,

        async json() {
          throw new Error(
            "provider-secret-response"
          );
        },
      });

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com",
        subject:
          "Verification",
        textBody:
          "Valid body",
        fetchImpl:
          malformedJsonFetch,
        env:
          makeValidEnv(),
      }),
      (error) => {
        assertDeliveryError(
          "transactional_email_provider_response_error",
          200
        )(error);

        assert.equal(
          error.message.includes(
            "provider-secret-response"
          ),
          false
        );

        return true;
      }
    );

    const missingIdFetch =
      async () => ({
        status: 200,

        async json() {
          return {
            unexpected:
              "provider payload",
          };
        },
      });

    await assert.rejects(
      sendTransactionalEmail({
        toEmail:
          "student@example.com",
        subject:
          "Verification",
        textBody:
          "Valid body",
        fetchImpl:
          missingIdFetch,
        env:
          makeValidEnv(),
      }),
      assertDeliveryError(
        "transactional_email_provider_response_error",
        200
      )
    );
  }
);


test(
  "idempotency header is omitted when caller does not supply one",
  async () => {
    let capturedHeaders;

    const fakeFetch =
      async (
        _url,
        options
      ) => {
        capturedHeaders =
          options.headers;

        return {
          status: 200,

          async json() {
            return {
              id:
                "resend-no-idempotency",
            };
          },
        };
      };

    await sendTransactionalEmail({
      toEmail:
        "student@example.com",
      subject:
        "Notification",
      textBody:
        "Valid body",
      fetchImpl:
        fakeFetch,
      env:
        makeValidEnv(),
    });

    assert.equal(
      Object.hasOwn(
        capturedHeaders,
        "Idempotency-Key"
      ),
      false
    );
  }
);

/*
 * Sender display-name contract.
 *
 * EMAIL_FROM remains the plain verified sender address.
 * EMAIL_FROM_NAME is optional, separately validated server
 * configuration and must never become arbitrary address/header syntax.
 */

test(
  "sender display-name configuration is optional, normalized and backward compatible",
  () => {
    const {
      getTransactionalEmailConfiguration,
      normalizeEmailFromName,
    } =
      require("../src/services/transactionalEmailTransportService");

    assert.equal(
      normalizeEmailFromName(
        "  PravixoEduTech  "
      ),
      "PravixoEduTech"
    );

    assert.equal(
      normalizeEmailFromName(
        "  PravixoEduTech   Support  "
      ),
      "PravixoEduTech Support"
    );

    const bare =
      getTransactionalEmailConfiguration({
        EMAIL_PROVIDER:
          "resend",

        EMAIL_FROM:
          "Support@PravixoEduTech.in",

        RESEND_API_KEY:
          "re_sender_name_contract",
      });

    assert.deepEqual(
      bare,
      {
        provider:
          "resend",

        fromEmail:
          "support@pravixoedutech.in",

        apiKey:
          "re_sender_name_contract",
      }
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        bare,
        "fromName"
      ),
      false
    );

    const blank =
      getTransactionalEmailConfiguration({
        EMAIL_PROVIDER:
          "resend",

        EMAIL_FROM:
          "support@pravixoedutech.in",

        EMAIL_FROM_NAME:
          "   ",

        RESEND_API_KEY:
          "re_sender_name_contract",
      });

    assert.deepEqual(
      blank,
      {
        provider:
          "resend",

        fromEmail:
          "support@pravixoedutech.in",

        apiKey:
          "re_sender_name_contract",
      }
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        blank,
        "fromName"
      ),
      false
    );

    const branded =
      getTransactionalEmailConfiguration({
        EMAIL_PROVIDER:
          "resend",

        EMAIL_FROM:
          "Support@PravixoEduTech.in",

        EMAIL_FROM_NAME:
          "  PravixoEduTech  ",

        RESEND_API_KEY:
          "re_sender_name_contract",
      });

    assert.deepEqual(
      branded,
      {
        provider:
          "resend",

        fromEmail:
          "support@pravixoedutech.in",

        apiKey:
          "re_sender_name_contract",

        fromName:
          "PravixoEduTech",
      }
    );
  }
);


test(
  "Resend renders validated sender display name without widening credential boundary",
  async () => {
    const {
      sendTransactionalEmail,
    } =
      require("../src/services/transactionalEmailTransportService");

    let fetchCalls =
      0;

    let captured =
      null;

    const result =
      await sendTransactionalEmail({
        toEmail:
          "Student@Example.com",

        subject:
          "Verify your PravixoEduTech email",

        textBody:
          "Display-name transport contract.",

        env: {
          EMAIL_PROVIDER:
            "resend",

          EMAIL_FROM:
            "Support@PravixoEduTech.in",

          EMAIL_FROM_NAME:
            "PravixoEduTech",

          RESEND_API_KEY:
            "re_sender_name_delivery_secret",
        },

        fetchImpl:
          async (
            url,
            options
          ) => {
            fetchCalls +=
              1;

            captured = {
              url,
              options,
            };

            return {
              status:
                200,

              json:
                async () => ({
                  id:
                    "sender-name-contract-id",
                }),
            };
          },
      });

    assert.equal(
      fetchCalls,
      1
    );

    assert.ok(
      captured
    );

    assert.equal(
      captured.url,
      "https://api.resend.com/emails"
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
      captured.options.headers.Authorization,
      "Bearer re_sender_name_delivery_secret"
    );

    const payload =
      JSON.parse(
        captured.options.body
      );

    assert.equal(
      payload.from,
      "PravixoEduTech <support@pravixoedutech.in>"
    );

    assert.deepEqual(
      payload.to,
      [
        "student@example.com",
      ]
    );

    assert.equal(
      payload.subject,
      "Verify your PravixoEduTech email"
    );

    assert.equal(
      captured.options.body.includes(
        "re_sender_name_delivery_secret"
      ),
      false
    );

    assert.deepEqual(
      result,
      {
        provider:
          "resend",

        messageId:
          "sender-name-contract-id",
      }
    );
  }
);


test(
  "invalid configured sender display names fail before transport",
  async () => {
    const {
      TransactionalEmailDeliveryError,
      sendTransactionalEmail,
    } =
      require("../src/services/transactionalEmailTransportService");

    const invalidNames = [
      "PravixoEduTech\r\nBcc: attacker@example.com",
      "PravixoEduTech <attacker@example.com>",
      "\"PravixoEduTech\"",
      "PravixoEduTech: Support",
      123,
    ];

    let fetchCalls =
      0;

    for (
      const EMAIL_FROM_NAME
      of invalidNames
    ) {
      await assert.rejects(
        sendTransactionalEmail({
          toEmail:
            "student@example.com",

          subject:
            "Invalid sender-name contract",

          textBody:
            "Must fail before transport.",

          env: {
            EMAIL_PROVIDER:
              "resend",

            EMAIL_FROM:
              "support@pravixoedutech.in",

            EMAIL_FROM_NAME,

            RESEND_API_KEY:
              "re_invalid_sender_name_contract",
          },

          fetchImpl:
            async () => {
              fetchCalls +=
                1;

              throw new Error(
                "transport must not execute"
              );
            },
        }),

        (error) =>
          error instanceof
            TransactionalEmailDeliveryError &&
          error.type ===
            "transactional_email_configuration_error"
      );
    }

    assert.equal(
      fetchCalls,
      0
    );
  }
);
