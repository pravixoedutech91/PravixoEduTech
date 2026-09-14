const {
  normalizeSingleEmailAddress,
} = require(
  "../utils/emailAddressNormalization"
);

const {
  TransactionalEmailDeliveryError,
  buildCredentialSafeIdempotencyKey,
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
} = require("./transactionalEmailTransportService");

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

const buildNeutralEmailVerificationMessage = ({
  toEmail,
  verificationUrl,
  expiresAt,
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
    toEmail:
      normalizedTo,

    subject:
      EMAIL_VERIFICATION_EMAIL_SUBJECT,

    textBody,

    htmlBody,
  };
};

const mapTransactionalEmailDeliveryError = (
  error
) => {
  if (
    !(
      error instanceof
      TransactionalEmailDeliveryError
    )
  ) {
    return new EmailVerificationEmailDeliveryError({
      type:
        "email_verification_email_transport_error",
    });
  }

  const mappedTypes = {
    transactional_email_configuration_error:
      "email_verification_email_configuration_error",

    transactional_email_input_error:
      "email_verification_email_input_error",

    transactional_email_transport_error:
      "email_verification_email_transport_error",

    transactional_email_provider_error:
      "email_verification_email_provider_error",

    transactional_email_provider_response_error:
      "email_verification_email_provider_response_error",
  };

  return new EmailVerificationEmailDeliveryError({
    type:
      mappedTypes[error.type] ||
      "email_verification_email_transport_error",

    statusCode:
      error.statusCode,
  });
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
    /*
     * Preserve the existing verification delivery
     * boundary for callers and controller behavior.
     */
    if (
      typeof fetchImpl !==
        "function"
    ) {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_transport_error",
      });
    }

    try {
      getTransactionalEmailConfiguration(
        env
      );
    } catch (error) {
      throw mapTransactionalEmailDeliveryError(
        error
      );
    }

    /*
     * Verification URLs are bearer credentials.
     * Validate the trusted credential before deriving
     * any transport metadata from it.
     */
    const normalizedVerificationUrl =
      normalizeTrustedVerificationUrl(
        verificationUrl
      );

    if (!normalizedVerificationUrl) {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_input_error",
      });
    }

    /*
     * Build provider-neutral verification content.
     * Sender identity and provider credentials remain
     * inside the transactional transport boundary.
     */
    const message =
      buildNeutralEmailVerificationMessage({
        toEmail,

        verificationUrl:
          normalizedVerificationUrl,

        expiresAt,
      });

    const idempotencyKey =
      buildCredentialSafeIdempotencyKey({
        purpose:
          "email-verification",

        credentialUrl:
          normalizedVerificationUrl,
      });

    if (!idempotencyKey) {
      throw new EmailVerificationEmailDeliveryError({
        type:
          "email_verification_email_input_error",
      });
    }

    let deliveryResult;

    try {
      deliveryResult =
        await sendTransactionalEmail({
          toEmail:
            message.toEmail,

          subject:
            message.subject,

          textBody:
            message.textBody,

          htmlBody:
            message.htmlBody,

          idempotencyKey,

          fetchImpl,

          env,
        });
    } catch (error) {
      throw mapTransactionalEmailDeliveryError(
        error
      );
    }

    /*
     * Preserve the verification caller API.
     * Never return recipient, verification URL,
     * provider payload/name or API credential.
     */
    return {
      messageId:
        deliveryResult.messageId,
    };
};
module.exports = {
  EMAIL_VERIFICATION_EMAIL_SUBJECT,
  EMAIL_VERIFICATION_EMAIL_TAG,
  EmailVerificationEmailDeliveryError,
  normalizeTrustedVerificationUrl,
  buildNeutralEmailVerificationMessage,
  sendEmailVerificationEmail,
};
