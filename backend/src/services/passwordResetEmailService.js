const {
  PASSWORD_RESET_TOKEN_TTL_MS,
} = require("../utils/passwordResetSecurity");

const POSTMARK_EMAIL_ENDPOINT =
  "https://api.postmarkapp.com/email";

const POSTMARK_REQUEST_TIMEOUT_MS =
  10 * 1000;

const DEFAULT_POSTMARK_MESSAGE_STREAM =
  "outbound";

const PASSWORD_RESET_EMAIL_SUBJECT =
  "Reset your PravixoEduTech password";

const PASSWORD_RESET_EMAIL_TAG =
  "password-reset";

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

const normalizeSingleEmailAddress = (
  value
) => {
  if (typeof value !== "string") {
    return "";
  }

  const email =
    value
      .trim()
      .toLowerCase();

  if (
    !email ||
    email.length > 254 ||
    hasControlCharacters(email) ||
    email.includes(",") ||
    email.includes(";") ||
    email.includes(" ") ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return "";
  }

  return email;
};

const normalizeServerToken = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const token =
    value.trim();

  if (
    !token ||
    token.length > 512 ||
    /\s/.test(token) ||
    hasControlCharacters(token)
  ) {
    return "";
  }

  return token;
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

  if (typeof value !== "string") {
    return "";
  }

  const stream =
    value.trim();

  if (
    !stream ||
    stream.length > 100 ||
    !/^[A-Za-z0-9._-]+$/.test(
      stream
    )
  ) {
    return "";
  }

  return stream;
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

const getPostmarkConfiguration = (
  env = process.env
) => {
  const serverToken =
    normalizeServerToken(
      env &&
      env.POSTMARK_SERVER_TOKEN
    );

  const fromEmail =
    normalizeSingleEmailAddress(
      env &&
      env.POSTMARK_FROM_EMAIL
    );

  const messageStream =
    normalizeMessageStream(
      env &&
      env.POSTMARK_MESSAGE_STREAM
    );

  if (
    !serverToken ||
    !fromEmail ||
    !messageStream
  ) {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_configuration_error",
    });
  }

  return {
    serverToken,
    fromEmail,
    messageStream,
  };
};

const buildPasswordResetEmailMessage = ({
  toEmail,
  resetUrl,
  expiresAt,
  configuration,
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

  if (
    !configuration ||
    typeof configuration !== "object"
  ) {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_configuration_error",
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
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_configuration_error",
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
    From:
      "PravixoEduTech <" +
      fromEmail +
      ">",

    To:
      normalizedTo,

    Subject:
      PASSWORD_RESET_EMAIL_SUBJECT,

    TextBody:
      textBody,

    HtmlBody:
      htmlBody,

    MessageStream:
      messageStream,

    Tag:
      PASSWORD_RESET_EMAIL_TAG,

    /*
     * A password-reset URL is itself a credential.
     * Do not enable provider tracking for it.
     */
    TrackOpens:
      false,

    TrackLinks:
      "None",
  };
};

const sendPasswordResetEmail = async ({
  toEmail,
  resetUrl,
  expiresAt,
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) => {
  if (typeof fetchImpl !== "function") {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_transport_error",
    });
  }

  const configuration =
    getPostmarkConfiguration(
      env
    );

  const message =
    buildPasswordResetEmailMessage({
      toEmail,
      resetUrl,
      expiresAt,
      configuration,
    });

  let response;

  try {
    response =
      await fetchImpl(
        POSTMARK_EMAIL_ENDPOINT,
        {
          method: "POST",

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
           * The provider endpoint is fixed.
           * Never follow an unexpected redirect
           * while carrying a server credential.
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
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_transport_error",
    });
  }

  if (
    !response ||
    typeof response.status !== "number" ||
    response.status !== 200
  ) {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_provider_error",

      statusCode:
        response &&
        Number.isInteger(
          response.status
        )
          ? response.status
          : undefined,
    });
  }

  let providerResult;

  try {
    providerResult =
      await response.json();
  } catch {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_provider_response_error",

      statusCode:
        response.status,
    });
  }

  if (
    !providerResult ||
    providerResult.ErrorCode !== 0 ||
    typeof providerResult.MessageID !== "string" ||
    !providerResult.MessageID.trim()
  ) {
    throw new PasswordResetEmailDeliveryError({
      type:
        "password_reset_email_provider_response_error",

      statusCode:
        response.status,
    });
  }

  /*
   * Do not return recipient, token-bearing URL,
   * provider response body, or API credential.
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
  PASSWORD_RESET_EMAIL_SUBJECT,
  PASSWORD_RESET_EMAIL_TAG,
  PasswordResetEmailDeliveryError,
  normalizeSingleEmailAddress,
  normalizeTrustedResetUrl,
  getPostmarkConfiguration,
  buildPasswordResetEmailMessage,
  sendPasswordResetEmail,
};
