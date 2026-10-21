const crypto = require("crypto");

const RESEND_EMAIL_ENDPOINT =
  "https://api.resend.com/emails";

const RESEND_REQUEST_TIMEOUT_MS =
  10 * 1000;

const SUPPORTED_EMAIL_PROVIDERS =
  new Set(["resend"]);

class TransactionalEmailDeliveryError extends Error {
  constructor({
    type,
    statusCode,
  } = {}) {
    super(
      "Transactional email delivery is unavailable"
    );

    this.name =
      "TransactionalEmailDeliveryError";

    this.type =
      typeof type === "string" &&
      type.trim()
        ? type.trim()
        : "transactional_email_delivery_error";

    if (
      Number.isInteger(statusCode) &&
      statusCode >= 100 &&
      statusCode <= 599
    ) {
      this.statusCode = statusCode;
    }
  }
}

const hasControlCharacters = (value) =>
  /[\u0000-\u001F\u007F]/.test(
    String(value)
  );

const normalizeEmailProvider = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    !normalized ||
    hasControlCharacters(normalized) ||
    !SUPPORTED_EMAIL_PROVIDERS.has(
      normalized
    )
  ) {
    return "";
  }

  return normalized;
};

const normalizeEmailAddress = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    !normalized ||
    normalized.length > 254 ||
    hasControlCharacters(normalized) ||
    /\s/.test(normalized)
  ) {
    return "";
  }

  const atIndex =
    normalized.indexOf("@");

  if (
    atIndex <= 0 ||
    atIndex !==
      normalized.lastIndexOf("@") ||
    atIndex ===
      normalized.length - 1
  ) {
    return "";
  }

  const local =
    normalized.slice(0, atIndex);

  const domain =
    normalized.slice(atIndex + 1);

  if (
    local.length > 64 ||
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return "";
  }

  return normalized;
};

const normalizeEmailFromName = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  const normalized =
    value
      .trim()
      .replace(
        /[ \t]+/g,
        " "
      );

  /*
   * Display name is server-controlled configuration,
   * but still fail closed against header/address syntax.
   *
   * Keep this deliberately conservative:
   * letters, numbers, spaces and a small safe punctuation
   * set only. Angle brackets, quotes, slashes, colons,
   * CR/LF and other control characters are not accepted.
   */
  if (
    !normalized ||
    normalized.length > 100 ||
    hasControlCharacters(
      normalized
    ) ||
    !/^[A-Za-z0-9][A-Za-z0-9 .&'()_-]*$/.test(
      normalized
    )
  ) {
    return "";
  }

  return normalized;
};
const normalizeResendApiKey = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > 512 ||
    hasControlCharacters(normalized) ||
    /\s/.test(normalized) ||
    !normalized.startsWith("re_")
  ) {
    return "";
  }

  return normalized;
};

const normalizeRequiredText = (
  value,
  maxLength
) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > maxLength ||
    hasControlCharacters(normalized)
  ) {
    return "";
  }

  return normalized;
};

const hasUnsafeBodyControlCharacters = (
  value
) =>
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(
    String(value)
  );

const normalizeOptionalBody = (
  value,
  maxLength
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  /*
   * Email bodies legitimately contain TAB, LF and CR.
   * Reject the remaining C0 control range plus DEL.
   */
  if (
    value.length > maxLength ||
    hasUnsafeBodyControlCharacters(value)
  ) {
    return "";
  }

  return value;
};

const normalizeIdempotencyKey = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > 256 ||
    hasControlCharacters(normalized)
  ) {
    return "";
  }

  return normalized;
};

const buildCredentialSafeIdempotencyKey = ({
  purpose,
  credentialUrl,
} = {}) => {
  const normalizedPurpose =
    normalizeRequiredText(
      purpose,
      64
    );

  if (
    !normalizedPurpose ||
    typeof credentialUrl !== "string" ||
    !credentialUrl
  ) {
    return "";
  }

  /*
   * Never expose the raw verification/reset URL in
   * the provider idempotency header. Hash the complete
   * already-validated credential-bearing URL instead.
   */
  const digest =
    crypto
      .createHash("sha256")
      .update(
        credentialUrl,
        "utf8"
      )
      .digest("hex");

  return `${normalizedPurpose}/${digest}`;
};

const getTransactionalEmailConfiguration = (
  env = process.env
) => {
  const provider =
    normalizeEmailProvider(
      env &&
        env.EMAIL_PROVIDER
    );

  const fromEmail =
    normalizeEmailAddress(
      env &&
        env.EMAIL_FROM
    );

  const rawFromName =
    env &&
      env.EMAIL_FROM_NAME;

  const fromName =
    normalizeEmailFromName(
      rawFromName
    );

  /*
   * Missing or blank EMAIL_FROM_NAME is allowed so the
   * transport stays backward compatible.
   *
   * Any nonblank configured value must validate; never
   * silently downgrade malformed sender syntax.
   */
  const fromNameProvided =
    rawFromName !== undefined &&
    rawFromName !== null &&
    !(
      typeof rawFromName === "string" &&
      rawFromName.trim() === ""
    );

  if (
    !provider ||
    !fromEmail ||
    (
      fromNameProvided &&
      !fromName
    )
  ) {
    throw new TransactionalEmailDeliveryError({
      type:
        "transactional_email_configuration_error",
    });
  }

  if (provider === "resend") {
    const apiKey =
      normalizeResendApiKey(
        env &&
          env.RESEND_API_KEY
      );

    if (!apiKey) {
      throw new TransactionalEmailDeliveryError({
        type:
          "transactional_email_configuration_error",
      });
    }

    const configuration = {
      provider,
      fromEmail,
      apiKey,
    };

    if (fromName) {
      configuration.fromName =
        fromName;
    }

    return configuration;
  }

  throw new TransactionalEmailDeliveryError({
    type:
      "transactional_email_configuration_error",
  });
};

const sendTransactionalEmail = async ({
  toEmail,
  subject,
  textBody,
  htmlBody,
  idempotencyKey,
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) => {
  if (typeof fetchImpl !== "function") {
    throw new TransactionalEmailDeliveryError({
      type:
        "transactional_email_transport_error",
    });
  }

  const normalizedToEmail =
    normalizeEmailAddress(toEmail);

  const normalizedSubject =
    normalizeRequiredText(
      subject,
      998
    );

  const normalizedTextBody =
    normalizeOptionalBody(
      textBody,
      200000
    );

  const normalizedHtmlBody =
    normalizeOptionalBody(
      htmlBody,
      500000
    );

  const normalizedIdempotencyKey =
    normalizeIdempotencyKey(
      idempotencyKey
    );

  if (
    !normalizedToEmail ||
    !normalizedSubject ||
    (
      !normalizedTextBody &&
      !normalizedHtmlBody
    )
  ) {
    throw new TransactionalEmailDeliveryError({
      type:
        "transactional_email_input_error",
    });
  }

  const configuration =
    getTransactionalEmailConfiguration(
      env
    );

  if (
    configuration.provider !== "resend"
  ) {
    throw new TransactionalEmailDeliveryError({
      type:
        "transactional_email_configuration_error",
    });
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      RESEND_REQUEST_TIMEOUT_MS
    );

  let response;

  try {
    const headers = {
      Accept: "application/json",
      Authorization:
        `Bearer ${configuration.apiKey}`,
      "Content-Type":
        "application/json",
    };

    if (normalizedIdempotencyKey) {
      headers["Idempotency-Key"] =
        normalizedIdempotencyKey;
    }

    const body = {
      from:
        configuration.fromName
          ? `${configuration.fromName} <${configuration.fromEmail}>`
          : configuration.fromEmail,
      to: [normalizedToEmail],
      subject:
        normalizedSubject,
    };

    if (normalizedTextBody) {
      body.text =
        normalizedTextBody;
    }

    if (normalizedHtmlBody) {
      body.html =
        normalizedHtmlBody;
    }

    response =
      await fetchImpl(
        RESEND_EMAIL_ENDPOINT,
        {
          method: "POST",
          headers,

          /*
           * The provider endpoint is fixed. Reject redirects
           * while carrying the Resend bearer credential.
           */
          redirect: "error",

          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
  } catch {
    throw new TransactionalEmailDeliveryError({
      type:
        "transactional_email_transport_error",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (
    !response ||
    typeof response.status !== "number" ||
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new TransactionalEmailDeliveryError({
      type:
        "transactional_email_provider_error",
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
    throw new TransactionalEmailDeliveryError({
      type:
        "transactional_email_provider_response_error",
      statusCode:
        response.status,
    });
  }

  if (
    !providerResult ||
    typeof providerResult.id !== "string" ||
    !providerResult.id.trim()
  ) {
    throw new TransactionalEmailDeliveryError({
      type:
        "transactional_email_provider_response_error",
      statusCode:
        response.status,
    });
  }

  /*
   * Never return the recipient, credential-bearing URL,
   * provider response body, API key or message content.
   */
  return {
    provider:
      configuration.provider,
    messageId:
      providerResult.id.trim(),
  };
};

module.exports = {
  RESEND_EMAIL_ENDPOINT,
  RESEND_REQUEST_TIMEOUT_MS,
  TransactionalEmailDeliveryError,
  normalizeEmailProvider,
  normalizeEmailAddress,
  normalizeEmailFromName,
  normalizeResendApiKey,
  normalizeIdempotencyKey,
  buildCredentialSafeIdempotencyKey,
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
};