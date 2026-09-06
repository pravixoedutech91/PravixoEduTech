const {
  POSTMARK_EMAIL_ENDPOINT,
  POSTMARK_REQUEST_TIMEOUT_MS,
  DEFAULT_POSTMARK_MESSAGE_STREAM,
  normalizeSingleEmailAddress,
  getPostmarkConfiguration,
} = require(
  "./passwordResetEmailService"
);

const {
  STUDENT_EMAIL_VERIFICATION_PATH,
  getEmailVerificationFrontendOrigin,
} = require(
  "./emailVerificationLinkService"
);

const {
  isValidEmailVerificationTokenFormat,
} = require(
  "../utils/emailVerificationSecurity"
);

const EMAIL_VERIFICATION_EMAIL_SUBJECT =
  "Verify your PravixoEduTech email";

const EMAIL_VERIFICATION_EMAIL_TAG =
  "email-verification";

class EmailVerificationEmailDeliveryError extends Error {
  constructor({
    type,
    statusCode,
  } = {}) {
    super(
      "Email verification delivery failed"
    );

    this.name =
      "EmailVerificationEmailDeliveryError";

    this.type =
      typeof type === "string" &&
      type
        ? type
        : "email_verification_email_delivery_error";

    if (
      Number.isInteger(
        statusCode
      )
    ) {
      this.statusCode =
        statusCode;
    }
  }
}

const hasControlCharacters = (
  value
) => {
  return /[\u0000-\u001F\u007F]/.test(
    value
  );
};

const normalizeMessageStream = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return DEFAULT_POSTMARK_MESSAGE_STREAM;
  }

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  const stream =
    value.trim();

  if (
    !stream ||
    stream.length > 100 ||
    hasControlCharacters(
      stream
    ) ||
    /\s/.test(
      stream
    )
  ) {
    return "";
  }

  return stream;
};

const normalizeTrustedVerificationUrl =
  (value) => {
    if (
      typeof value !== "string"
    ) {
      return "";
    }

    const raw =
      value.trim();

    if (
      !raw ||
      raw.length > 4096 ||
      hasControlCharacters(
        raw
      )
    ) {
      return "";
    }

    let parsed;

    try {
      parsed =
        new URL(
          raw
        );
    } catch {
      return "";
    }

    let trustedOrigin;

    try {
      trustedOrigin =
        getEmailVerificationFrontendOrigin();
    } catch {
      return "";
    }

    if (
      parsed.origin !==
        trustedOrigin ||
      parsed.pathname !==
        STUDENT_EMAIL_VERIFICATION_PATH ||
      parsed.search ||
      parsed.username ||
      parsed.password
    ) {
      return "";
    }

    const expectedPrefix =
      "#token=";

    if (
      !parsed.hash.startsWith(
        expectedPrefix
      )
    ) {
      return "";
    }

    const token =
      parsed.hash.slice(
        expectedPrefix.length
      );

    if (
      !isValidEmailVerificationTokenFormat(
        token
      )
    ) {
      return "";
    }

    /*
     * Require the fragment to contain exactly one
     * canonical credential and nothing else.
     */
    if (
      parsed.hash !==
        expectedPrefix +
          token
    ) {
      return "";
    }

    return parsed.toString();
  };

const escapeHtml = (
  value
) => {
  return String(
    value
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#39;"
    );
};

const buildEmailVerificationMessage = ({
  toEmail,
  verificationUrl,
  expiresAt,
  configuration,
} = {}) => {
  const normalizedTo =
    normalizeSingleEmailAddress(
      toEmail
    );

  const normalizedVerificationUrl =
    normalizeTrustedVerificationUrl(
      verificationUrl
    );

  if (
    !normalizedTo ||
    !normalizedVerificationUrl
  ) {
    throw new EmailVerificationEmailDeliveryError({
      type:
        "email_verification_email_input_error",
    });
  }

  if (
    !(expiresAt instanceof Date) ||
    Number.isNaN(
      expiresAt.getTime()
    )
  ) {
    throw new EmailVerificationEmailDeliveryError({
      type:
        "email_verification_email_input_error",
    });
  }

  if (
    !configuration ||
    typeof configuration !==
      "object"
  ) {
    throw new EmailVerificationEmailDeliveryError({
      type:
        "email_verification_email_configuration_error",
    });
  }

  const fromEmail =
    normalizeSingleEmailAddress(
      configuration.fromEmail
    );

  const messageStream =
    normalizeMessageStream(
      configuration.messageStream
    );

  if (
    !fromEmail ||
    !messageStream
  ) {
    throw new EmailVerificationEmailDeliveryError({
      type:
        "email_verification_email_configuration_error",
    });
  }

  const safeVerificationUrl =
    escapeHtml(
      normalizedVerificationUrl
    );

  const expiresIso =
    expiresAt.toISOString();

  const safeExpiresIso =
    escapeHtml(
      expiresIso
    );

  const textBody = [
    "Verify your PravixoEduTech email",
    "",
    "Please confirm that this email address belongs to you.",
    "",
    "Open this secure verification link:",
    normalizedVerificationUrl,
    "",
    "This link expires in 24 hours and can be used only once.",
    "Expiry: " +
      expiresIso,
    "",
    "If you did not create a PravixoEduTech account, you can ignore this email.",
    "",
    "For your security, never forward or share this verification link.",
  ].join(
    "\n"
  );

  const htmlBody = [
    "<!doctype html>",
    '<html lang="en">',
    "<body>",
    "<h2>Verify your PravixoEduTech email</h2>",
    "<p>Please confirm that this email address belongs to you.</p>",
    '<p><a href="' +
      safeVerificationUrl +
      '">Verify email address</a></p>',
    "<p>This link expires in 24 hours and can be used only once.</p>",
    "<p>Expiry: " +
      safeExpiresIso +
      "</p>",
    "<p>If you did not create a PravixoEduTech account, you can ignore this email.</p>",
    "<p>For your security, never forward or share this verification link.</p>",
    "</body>",
    "</html>",
  ].join(
    ""
  );

  return {
    From:
      "PravixoEduTech <" +
      fromEmail +
      ">",

    To:
      normalizedTo,

    Subject:
      EMAIL_VERIFICATION_EMAIL_SUBJECT,

    TextBody:
      textBody,

    HtmlBody:
      htmlBody,

    MessageStream:
      messageStream,

    Tag:
      EMAIL_VERIFICATION_EMAIL_TAG,

    /*
     * A verification URL is a bearer credential.
     * Provider-side open/link tracking stays disabled.
     */
    TrackOpens:
      false,

    TrackLinks:
      "None",
  };
};

const sendEmailVerificationEmail =
  async ({
    toEmail,
    verificationUrl,
    expiresAt,
    fetchImpl =
      globalThis.fetch,
    env =
      process.env,
  } = {}) => {
    if (
      typeof fetchImpl !==
        "function"
    ) {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_transport_error",
      });
    }

    let configuration;

    try {
      configuration =
        getPostmarkConfiguration(
          env
        );
    } catch {
      /*
       * Do not leak reset-specific provider/configuration
       * error types through the verification boundary.
       */
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_configuration_error",
      });
    }

    const message =
      buildEmailVerificationMessage({
        toEmail,
        verificationUrl,
        expiresAt,
        configuration,
      });

    let response;

    try {
      response =
        await fetchImpl(
          POSTMARK_EMAIL_ENDPOINT,
          {
            method:
              "POST",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",

              "X-Postmark-Server-Token":
                configuration.serverToken,
            },

            body:
              JSON.stringify(
                message
              ),

            /*
             * Never allow a redirect while carrying the
             * Postmark server credential.
             */
            redirect:
              "error",

            signal:
              AbortSignal.timeout(
                POSTMARK_REQUEST_TIMEOUT_MS
              ),
          }
        );
    } catch {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_transport_error",
      });
    }

    if (
      !response ||
      typeof response.ok !==
        "boolean" ||
      !Number.isInteger(
        response.status
      )
    ) {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_provider_response_error",
      });
    }

    if (
      !response.ok
    ) {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_provider_error",

        statusCode:
          response.status,
      });
    }

    let providerResult;

    try {
      providerResult =
        await response.json();
    } catch {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_provider_response_error",

        statusCode:
          response.status,
      });
    }

    if (
      !providerResult ||
      typeof providerResult !==
        "object" ||
      providerResult.ErrorCode !==
        0 ||
      typeof providerResult.MessageID !==
        "string" ||
      !providerResult.MessageID.trim()
    ) {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_provider_response_error",

        statusCode:
          response.status,
      });
    }

    /*
     * Never return recipient, verification URL,
     * provider response body, or Postmark credential.
     */
    return {
      messageId:
        providerResult
          .MessageID
          .trim(),
    };
  };

module.exports = {
  POSTMARK_EMAIL_ENDPOINT,
  POSTMARK_REQUEST_TIMEOUT_MS,
  DEFAULT_POSTMARK_MESSAGE_STREAM,
  EMAIL_VERIFICATION_EMAIL_SUBJECT,
  EMAIL_VERIFICATION_EMAIL_TAG,
  EmailVerificationEmailDeliveryError,
  normalizeTrustedVerificationUrl,
  buildEmailVerificationMessage,
  sendEmailVerificationEmail,
};
