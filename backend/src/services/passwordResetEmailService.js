const {
  normalizeSingleEmailAddress,
} = require(
  "../utils/emailAddressNormalization"
);
const {
  PASSWORD_RESET_TOKEN_TTL_MS,
} = require("../utils/passwordResetSecurity");

const {
  TransactionalEmailDeliveryError,
  buildCredentialSafeIdempotencyKey,
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
} = require(
  "./transactionalEmailTransportService"
);
const PASSWORD_RESET_EMAIL_SUBJECT =
  "Reset your PravixoEduTech password";

class PasswordResetEmailDeliveryError extends Error {
  constructor({
    type,
    statusCode,
  } = {}) {
    super(
      "Password reset email delivery failed"
    );

    this.name =
      "PasswordResetEmailDeliveryError";

    this.type =
      typeof type === "string" &&
      type
        ? type
        : "password_reset_email_delivery_error";

    if (
      Number.isInteger(statusCode) &&
      statusCode >= 100 &&
      statusCode <= 599
    ) {
      this.statusCode =
        statusCode;
    }
  }
}

const hasControlCharacters = (value) => {
  return /[\u0000-\u001F\u007F]/.test(
    value
  );
};

const isLocalDevelopmentHostname = (
  hostname
) => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
};

const normalizeTrustedResetUrl = (
  value
) => {
  if (typeof value !== "string") {
    return "";
  }

  const raw =
    value.trim();

  if (
    !raw ||
    raw.length > 2048 ||
    hasControlCharacters(raw)
  ) {
    return "";
  }

  let parsed;

  try {
    parsed =
      new URL(raw);
  } catch {
    return "";
  }

  const isSecure =
    parsed.protocol === "https:";

  const isLocalHttp =
    parsed.protocol === "http:" &&
    isLocalDevelopmentHostname(
      parsed.hostname
    );

  if (
    !isSecure &&
    !isLocalHttp
  ) {
    return "";
  }

  /*
   * Reset credentials belong in the URL fragment,
   * never in query parameters or userinfo.
   *
   * B2 will additionally bind the origin/path
   * to trusted application configuration.
   */
  if (
    parsed.search ||
    parsed.username ||
    parsed.password ||
    !parsed.hash
  ) {
    return "";
  }

  return parsed.toString();
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const buildNeutralPasswordResetEmailMessage = ({
  toEmail,
  resetUrl,
  expiresAt,
} = {}) => {
  const normalizedTo =
    normalizeSingleEmailAddress(
      toEmail
    );

  const normalizedResetUrl =
    normalizeTrustedResetUrl(
      resetUrl
    );

  if (
    !normalizedTo ||
    !normalizedResetUrl
  ) {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_input_error",
    });
  }

  if (
    !(expiresAt instanceof Date) ||
    Number.isNaN(
      expiresAt.getTime()
    )
  ) {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_input_error",
    });
  }

  const expiryMinutes =
    Math.ceil(
      PASSWORD_RESET_TOKEN_TTL_MS /
        60000
    );

  const safeResetUrl =
    escapeHtml(
      normalizedResetUrl
    );

  const textBody = [
    "PravixoEduTech password reset",
    "",
    "We received a request to reset your password.",
    "",
    "Open this secure link:",
    normalizedResetUrl,
    "",
    "This link expires in " +
      expiryMinutes +
      " minutes and can be used only once.",
    "",
    "If you did not request this change, you can ignore this email.",
    "",
    "For your security, PravixoEduTech will never ask you to send your password or reset link by email.",
  ].join("\n");

  const htmlBody = [
    "<!doctype html>",
    '<html lang="en">',
    "<body>",
    "<h2>Reset your PravixoEduTech password</h2>",
    "<p>We received a request to reset your password.</p>",
    '<p><a href="' +
      safeResetUrl +
      '">Reset password</a></p>',
    "<p>This link expires in " +
      expiryMinutes +
      " minutes and can be used only once.</p>",
    "<p>If you did not request this change, you can ignore this email.</p>",
    "<p>For your security, PravixoEduTech will never ask you to send your password or reset link by email.</p>",
    "</body>",
    "</html>",
  ].join("");

  return {
    toEmail:
      normalizedTo,

    subject:
      PASSWORD_RESET_EMAIL_SUBJECT,

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
    return new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_transport_error",
    });
  }

  const mappedTypes = {
    transactional_email_configuration_error:
      "password_reset_email_configuration_error",

    transactional_email_input_error:
      "password_reset_email_input_error",

    transactional_email_transport_error:
      "password_reset_email_transport_error",

    transactional_email_provider_error:
      "password_reset_email_provider_error",

    transactional_email_provider_response_error:
      "password_reset_email_provider_response_error",
  };

  return new PasswordResetEmailDeliveryError({
    type:
      mappedTypes[error.type] ||
      "password_reset_email_transport_error",

    statusCode:
      error.statusCode,
  });
};

const sendPasswordResetEmail = async ({
  toEmail,
  resetUrl,
  expiresAt,
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) => {
  /*
   * Preserve the existing public password-reset
   * delivery contract: missing transport authority
   * is a password-reset transport error.
   */
  if (typeof fetchImpl !== "function") {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_transport_error",
    });
  }

  const normalizedResetUrl =
    normalizeTrustedResetUrl(
      resetUrl
    );

  if (!normalizedResetUrl) {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_input_error",
    });
  }

  let configuration;

  try {
    configuration =
      getTransactionalEmailConfiguration(
        env
      );
  } catch (error) {
    throw mapTransactionalEmailDeliveryError(
      error
    );
  }

  const message =
    buildNeutralPasswordResetEmailMessage({
      toEmail,

      resetUrl:
        normalizedResetUrl,

      expiresAt,
    });
  const idempotencyKey =
    buildCredentialSafeIdempotencyKey({
      purpose:
        "password-reset",

      credentialUrl:
        normalizedResetUrl,
    });

  if (!idempotencyKey) {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_input_error",
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
   * Preserve the existing password-reset caller API.
   * Never return recipient, credential-bearing URL,
   * provider payload, provider name or API credential.
   */
  return {
    messageId:
      deliveryResult.messageId,
  };
};

module.exports = {
  PASSWORD_RESET_EMAIL_SUBJECT,
  PasswordResetEmailDeliveryError,
  normalizeTrustedResetUrl,
  buildNeutralPasswordResetEmailMessage,
  sendPasswordResetEmail,
};
