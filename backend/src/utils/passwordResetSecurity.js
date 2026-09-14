const crypto = require("crypto");

const PASSWORD_RESET_TOKEN_BYTES = 32;

const PASSWORD_RESET_TOKEN_TTL_MS =
  15 * 60 * 1000;

const PASSWORD_RESET_TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/;

const MIN_PASSWORD_CHARACTERS = 8;
const MAX_PASSWORD_UTF8_BYTES = 72;

const normalizePasswordRecoveryLogin = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  return trimmed.replace(/\D/g, "");
};

const isValidPasswordResetTokenFormat = (value) => {
  return (
    typeof value === "string" &&
    PASSWORD_RESET_TOKEN_PATTERN.test(value)
  );
};

const hashPasswordResetToken = (rawToken) => {
  if (!isValidPasswordResetTokenFormat(rawToken)) {
    throw new TypeError(
      "Invalid password reset token format"
    );
  }

  return crypto
    .createHash("sha256")
    .update(rawToken, "utf8")
    .digest("hex");
};

const createPasswordResetToken = (
  now = new Date()
) => {
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    throw new TypeError(
      "A valid Date is required"
    );
  }

  const rawToken = crypto
    .randomBytes(PASSWORD_RESET_TOKEN_BYTES)
    .toString("base64url");

  if (
    !isValidPasswordResetTokenFormat(rawToken)
  ) {
    throw new Error(
      "Generated password reset token has an invalid format"
    );
  }

  const tokenHash =
    hashPasswordResetToken(rawToken);

  const expiresAt = new Date(
    now.getTime() +
      PASSWORD_RESET_TOKEN_TTL_MS
  );

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
};

const getResetPasswordValidationError = (
  password
) => {
  if (
    typeof password !== "string" ||
    password.length <
      MIN_PASSWORD_CHARACTERS
  ) {
    return "Password must be at least 8 characters";
  }

  if (
    Buffer.byteLength(password, "utf8") >
      MAX_PASSWORD_UTF8_BYTES
  ) {
    return "Password must not exceed 72 UTF-8 bytes";
  }

  return null;
};

module.exports = {
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TOKEN_TTL_MS,
  MIN_PASSWORD_CHARACTERS,
  MAX_PASSWORD_UTF8_BYTES,
  normalizePasswordRecoveryLogin,
  isValidPasswordResetTokenFormat,
  hashPasswordResetToken,
  createPasswordResetToken,
  getResetPasswordValidationError,
};
