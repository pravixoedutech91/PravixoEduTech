const {
  isHostedEnvironment,
} = require("../utils/runtimeSecurity");

const {
  isValidPasswordResetTokenFormat,
} = require("../utils/passwordResetSecurity");

const PASSWORD_RESET_FRONTEND_ORIGIN_ENV =
  "PASSWORD_RESET_FRONTEND_ORIGIN";

const LOCAL_PASSWORD_RESET_FRONTEND_ORIGIN =
  "http://localhost:3000";

const STUDENT_PASSWORD_RESET_PATH =
  "/student/reset-password";

class PasswordResetLinkError extends Error {
  constructor(type) {
    super(
      "Password reset link configuration is unavailable"
    );

    this.name =
      "PasswordResetLinkError";

    this.type =
      typeof type === "string" &&
      type
        ? type
        : "password_reset_link_error";
  }
}

const hasControlCharacters = (value) => {
  return /[\u0000-\u001F\u007F]/.test(
    value
  );
};

const isLocalHostname = (hostname) => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
};

const normalizePasswordResetFrontendOrigin = (
  value,
  {
    hosted =
      isHostedEnvironment(),
  } = {}
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

  /*
   * This configuration represents an ORIGIN only.
   * Paths, query parameters, fragments and userinfo
   * are never permitted.
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
   * Hosted reset links must always use HTTPS and
   * must never target localhost/loopback.
   */
  if (hosted) {
    if (
      parsed.protocol !== "https:" ||
      localHostname
    ) {
      return "";
    }

    return parsed.origin;
  }

  /*
   * Development may use HTTP only for localhost.
   * Any remote/non-local origin still requires HTTPS.
   */
  if (
    parsed.protocol === "https:"
  ) {
    return parsed.origin;
  }

  if (
    parsed.protocol === "http:" &&
    localHostname
  ) {
    return parsed.origin;
  }

  return "";
};

const getPasswordResetFrontendOrigin = () => {
  const hosted =
    isHostedEnvironment();

  const configured =
    process.env[
      PASSWORD_RESET_FRONTEND_ORIGIN_ENV
    ];

  /*
   * Local development has one fixed convenience
   * default. Hosted environments must configure
   * the reset origin explicitly and fail closed.
   */
  const candidate =
    typeof configured === "string" &&
    configured.trim()
      ? configured
      : hosted
        ? ""
        : LOCAL_PASSWORD_RESET_FRONTEND_ORIGIN;

  const origin =
    normalizePasswordResetFrontendOrigin(
      candidate,
      {
        hosted,
      }
    );

  if (!origin) {
    throw new PasswordResetLinkError(
      "password_reset_origin_configuration_error"
    );
  }

  return origin;
};

const buildStudentPasswordResetUrl = ({
  rawToken,
} = {}) => {
  /*
   * The caller supplies ONLY the cryptographic
   * credential. Origin and path are trusted
   * server-side configuration/constants.
   */
  if (
    !isValidPasswordResetTokenFormat(
      rawToken
    )
  ) {
    throw new PasswordResetLinkError(
      "password_reset_link_input_error"
    );
  }

  const trustedOrigin =
    getPasswordResetFrontendOrigin();

  const resetUrl =
    new URL(
      STUDENT_PASSWORD_RESET_PATH,
      trustedOrigin + "/"
    );

  /*
   * Credential belongs only in the fragment.
   * Fragment content is not sent to the web server
   * as part of the HTTP request URL.
   */
  resetUrl.hash =
    "token=" +
    encodeURIComponent(
      rawToken
    );

  if (
    resetUrl.search ||
    resetUrl.origin !== trustedOrigin ||
    resetUrl.pathname !==
      STUDENT_PASSWORD_RESET_PATH
  ) {
    throw new PasswordResetLinkError(
      "password_reset_link_generation_error"
    );
  }

  return resetUrl.toString();
};

module.exports = {
  PASSWORD_RESET_FRONTEND_ORIGIN_ENV,
  LOCAL_PASSWORD_RESET_FRONTEND_ORIGIN,
  STUDENT_PASSWORD_RESET_PATH,
  PasswordResetLinkError,
  normalizePasswordResetFrontendOrigin,
  getPasswordResetFrontendOrigin,
  buildStudentPasswordResetUrl,
};
