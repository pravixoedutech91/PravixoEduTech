const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  PasswordResetEmailDeliveryError,
  buildNeutralPasswordResetEmailMessage,
} = require(
  "../src/services/passwordResetEmailService"
);


const canonicalResetUrl =
  "https://pravixoedutech.in/student/reset-password#token=permanent-contract-token";

const validExpiresAt =
  new Date(
    "2026-09-13T12:00:00.000Z"
  );


test(
  "neutral password-reset message builder exposes provider-independent message shape",
  () => {

    assert.equal(
      typeof buildNeutralPasswordResetEmailMessage,
      "function"
    );


    const message =
      buildNeutralPasswordResetEmailMessage({
        toEmail:
          " Student@Example.com ",

        resetUrl:
          canonicalResetUrl,

        expiresAt:
          validExpiresAt,
      });


    assert.deepEqual(
      Object.keys(message),
      [
        "toEmail",
        "subject",
        "textBody",
        "htmlBody",
      ]
    );


    assert.equal(
      message.toEmail,
      "student@example.com"
    );

    assert.equal(
      message.subject,
      "Reset your PravixoEduTech password"
    );

    assert.equal(
      typeof message.textBody,
      "string"
    );

    assert.equal(
      typeof message.htmlBody,
      "string"
    );


    const forbiddenFields = [
      "From",
      "To",
      "Subject",
      "TextBody",
      "HtmlBody",
      "MessageStream",
      "Tag",
      "TrackOpens",
      "TrackLinks",
      "configuration",
      "fromEmail",
      "provider",
      "apiKey",
    ];


    for (
      const field of
      forbiddenFields
    ) {

      assert.equal(
        Object.prototype.hasOwnProperty.call(
          message,
          field
        ),
        false,
        field
      );
    }
  }
);


test(
  "neutral password-reset message preserves trusted credential URL and established content",
  () => {

    const message =
      buildNeutralPasswordResetEmailMessage({
        toEmail:
          "student@example.com",

        resetUrl:
          canonicalResetUrl,

        expiresAt:
          validExpiresAt,
      });


    assert.equal(
      message.textBody.includes(
        canonicalResetUrl
      ),
      true
    );

    assert.equal(
      message.htmlBody.includes(
        canonicalResetUrl
      ),
      true
    );


    assert.equal(
      message.textBody.includes(
        "This link expires in 15 minutes and can be used only once."
      ),
      true
    );

    assert.equal(
      message.htmlBody.includes(
        "This link expires in 15 minutes and can be used only once.</p>"
      ),
      true
    );


    assert.equal(
      message.textBody.includes(
        "PravixoEduTech will never ask you to send your password or reset link by email."
      ),
      true
    );

    assert.equal(
      message.htmlBody.includes(
        "PravixoEduTech will never ask you to send your password or reset link by email."
      ),
      true
    );


    assert.equal(
      message.textBody.includes(
        "Open this secure link:"
      ),
      true
    );

    assert.equal(
      message.htmlBody.includes(
        ">Reset password</a>"
      ),
      true
    );
  }
);


test(
  "neutral password-reset message rejects malformed recipient invalid reset URL and invalid expiry",
  () => {

    const expectInputError =
      (factory) => {

        assert.throws(
          factory,
          (error) => {

            assert.equal(
              error instanceof
                PasswordResetEmailDeliveryError,
              true
            );

            assert.equal(
              error.type,
              "password_reset_email_input_error"
            );

            return true;
          }
        );
      };


    expectInputError(
      () =>
        buildNeutralPasswordResetEmailMessage({
          toEmail:
            "not-an-email",

          resetUrl:
            canonicalResetUrl,

          expiresAt:
            validExpiresAt,
        })
    );


    expectInputError(
      () =>
        buildNeutralPasswordResetEmailMessage({
          toEmail:
            "student@example.com",

          resetUrl:
            "not-a-valid-reset-url",

          expiresAt:
            validExpiresAt,
        })
    );


    expectInputError(
      () =>
        buildNeutralPasswordResetEmailMessage({
          toEmail:
            "student@example.com",

          resetUrl:
            canonicalResetUrl,

          expiresAt:
            new Date("invalid"),
        })
    );


    expectInputError(
      () =>
        buildNeutralPasswordResetEmailMessage({
          toEmail:
            "student@example.com",

          resetUrl:
            canonicalResetUrl,

          expiresAt:
            "2026-09-13T12:00:00.000Z",
        })
    );
  }
);


test(
  "neutral password-reset builder function contains no provider or transport authority",
  () => {

    const source =
      buildNeutralPasswordResetEmailMessage
        .toString();


    const forbidden = [
      "POSTMARK_",
      "Postmark",
      "postmarkapp.com",
      "X-Postmark",
      "MessageStream",
      "TrackOpens",
      "TrackLinks",
      "getPostmarkConfiguration",
      "getTransactionalEmailConfiguration",
      "sendTransactionalEmail",
      "RESEND_API_KEY",
      "EMAIL_PROVIDER",
      "EMAIL_FROM",
    ];


    for (
      const literal of
      forbidden
    ) {

      assert.equal(
        source.includes(
          literal
        ),
        false,
        literal
      );
    }


    assert.equal(
      source.includes(
        "normalizeSingleEmailAddress"
      ),
      true
    );

    assert.equal(
      source.includes(
        "normalizeTrustedResetUrl"
      ),
      true
    );
  }
);
