const {
  isValidEmailVerificationTokenFormat,
} = require(
  "../utils/emailVerificationSecurity"
);

const EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV =
  "EMAIL_VERIFICATION_FRONTEND_ORIGIN";

const LOCAL_EMAIL_VERIFICATION_FRONTEND_ORIGIN =
  "http://localhost:3000";

const STUDENT_EMAIL_VERIFICATION_PATH =
  "/student/verify-email";

class EmailVerificationLinkError extends Error {
  constructor(type) {
    super(
      "Email verification link configuration is unavailable"
    );

    this.name =
      "EmailVerificationLinkError";

    this.type =
      typeof type === "string" &&
      type
        ? type
        : "email_verification_link_error";
  }
}

const isHostedEnvironment = () => {
  return (
    process.env.NODE_ENV ===
      "production" ||
    Boolean(
      process.env
        .RAILWAY_ENVIRONMENT_NAME ||
      process.env
        .RAILWAY_DEPLOYMENT_ID
    )
  );
};

const hasControlCharacters = (
  value
) => {
  return /[\u0000-\u001F\u007F]/.test(
    value
  );
};

const isLocalHostname = (
  hostname
) => {
  return (
    hostname ===
      "localhost" ||
    hostname ===
      "127.0.0.1" ||
    hostname ===
      "::1" ||
    hostname ===
      "[::1]"
  );
};

const normalizeEmailVerificationFrontendOrigin = (
  value,
  {
    hosted =
      isHostedEnvironment(),
  } = {}
) => {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  const raw =
    value.trim();

  if (
    !raw ||
    raw.length > 2048 ||
    hasControlCharacters(
      raw
    )
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

  if (
    parsed.protocol !==
      "http:" &&
    parsed.protocol !==
      "https:"
  ) {
    return "";
  }

  /*
   * Configuration must represent an ORIGIN only.
   * No credentials, path, query or fragment authority
   * is accepted from configuration.
   */
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    return "";
  }

  const localHostname =
    isLocalHostname(
      parsed.hostname
    );

  /*
   * Hosted verification links must be HTTPS and
   * must never resolve to localhost.
   */
  if (hosted) {
    if (
      parsed.protocol !==
        "https:" ||
      localHostname
    ) {
      return "";
    }
  } else if (
    parsed.protocol ===
      "http:" &&
    !localHostname
  ) {
    /*
     * Plain HTTP is allowed only for local development.
     */
    return "";
  }

  return parsed.origin;
};

const getEmailVerificationFrontendOrigin =
  () => {
    const hosted =
      isHostedEnvironment();

    const configured =
      process.env[
        EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV
      ];

    /*
     * Local development has one fixed convenience
     * origin. Hosted environments must explicitly
     * configure verification origin and fail closed.
     */
    const candidate =
      typeof configured ===
        "string" &&
      configured.trim()
        ? configured
        : hosted
          ? ""
          : LOCAL_EMAIL_VERIFICATION_FRONTEND_ORIGIN;

    const origin =
      normalizeEmailVerificationFrontendOrigin(
        candidate,
        {
          hosted,
        }
      );

    if (!origin) {
      throw new EmailVerificationLinkError(
        "email_verification_origin_configuration_error"
      );
    }

    return origin;
  };

const buildStudentEmailVerificationUrl = ({
  rawToken,
} = {}) => {
  /*
   * Only the cryptographic credential is caller-supplied.
   * Origin and route are trusted server-side values.
   */
  if (
    !isValidEmailVerificationTokenFormat(
      rawToken
    )
  ) {
    throw new EmailVerificationLinkError(
      "email_verification_link_input_error"
    );
  }

  const trustedOrigin =
    getEmailVerificationFrontendOrigin();

  const verificationUrl =
    new URL(
      STUDENT_EMAIL_VERIFICATION_PATH,
      trustedOrigin
    );

  /*
   * Credential lives only in the fragment.
   *
   * Fragments are not sent in HTTP requests to the
   * frontend/server and therefore do not enter normal
   * server request logs.
   */
  verificationUrl.hash =
    "token=" +
    rawToken;

  if (
    verificationUrl.origin !==
      trustedOrigin ||
    verificationUrl.pathname !==
      STUDENT_EMAIL_VERIFICATION_PATH ||
    verificationUrl.search ||
    verificationUrl.username ||
    verificationUrl.password ||
    verificationUrl.hash !==
      "#token=" +
        rawToken
  ) {
    throw new EmailVerificationLinkError(
      "email_verification_link_generation_error"
    );
  }

  return verificationUrl.toString();
};

module.exports = {
  EMAIL_VERIFICATION_FRONTEND_ORIGIN_ENV,
  LOCAL_EMAIL_VERIFICATION_FRONTEND_ORIGIN,
  STUDENT_EMAIL_VERIFICATION_PATH,
  EmailVerificationLinkError,
  normalizeEmailVerificationFrontendOrigin,
  getEmailVerificationFrontendOrigin,
  buildStudentEmailVerificationUrl,
};
