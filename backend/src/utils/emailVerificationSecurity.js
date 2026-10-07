const crypto = require("crypto");

const EMAIL_VERIFICATION_TOKEN_BYTES = 32;

const EMAIL_VERIFICATION_TOKEN_LENGTH = 43;

const EMAIL_VERIFICATION_TOKEN_TTL_MS =
  24 * 60 * 60 * 1000;

const EMAIL_VERIFICATION_TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/;

const SHA256_HEX_PATTERN =
  /^[a-f0-9]{64}$/;

const generateEmailVerificationToken = () => {
  const rawToken =
    crypto
      .randomBytes(
        EMAIL_VERIFICATION_TOKEN_BYTES
      )
      .toString("base64url");

  /*
   * 32 random bytes encoded as unpadded base64url
   * must always produce exactly 43 characters.
   */
  if (
    rawToken.length !==
      EMAIL_VERIFICATION_TOKEN_LENGTH ||
    !EMAIL_VERIFICATION_TOKEN_PATTERN.test(
      rawToken
    )
  ) {
    throw new Error(
      "Email verification token generation failed"
    );
  }

  return rawToken;
};

const isValidEmailVerificationTokenFormat = (
  value
) => {
  return (
    typeof value === "string" &&
    value.length ===
      EMAIL_VERIFICATION_TOKEN_LENGTH &&
    EMAIL_VERIFICATION_TOKEN_PATTERN.test(
      value
    )
  );
};

const hashEmailVerificationToken = (
  rawToken
) => {
  /*
   * Reject malformed public input before performing
   * any credential lookup/hash-based database query.
   */
  if (
    !isValidEmailVerificationTokenFormat(
      rawToken
    )
  ) {
    return "";
  }

  return crypto
    .createHash("sha256")
    .update(
      rawToken,
      "utf8"
    )
    .digest("hex");
};

const normalizeEmailForVerification = (
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
    /[\u0000-\u001F\u007F]/.test(
      email
    ) ||
    email.includes(",") ||
    email.includes(";") ||
    /\s/.test(email)
  ) {
    return "";
  }

  const atIndex =
    email.indexOf("@");

  if (
    atIndex <= 0 ||
    atIndex !==
      email.lastIndexOf("@") ||
    atIndex ===
      email.length - 1
  ) {
    return "";
  }

  return email;
};

const hashEmailVerificationAddress = (
  email
) => {
  const normalizedEmail =
    normalizeEmailForVerification(
      email
    );

  if (!normalizedEmail) {
    return "";
  }

  return crypto
    .createHash("sha256")
    .update(
      normalizedEmail,
      "utf8"
    )
    .digest("hex");
};

const getEmailVerificationExpiresAt = (
  now = new Date()
) => {
  if (
    !(now instanceof Date) ||
    Number.isNaN(
      now.getTime()
    )
  ) {
    throw new TypeError(
      "Valid Date required"
    );
  }

  return new Date(
    now.getTime() +
      EMAIL_VERIFICATION_TOKEN_TTL_MS
  );
};

const isValidSha256Hex = (
  value
) => {
  return (
    typeof value === "string" &&
    SHA256_HEX_PATTERN.test(
      value
    )
  );
};

module.exports = {
  EMAIL_VERIFICATION_TOKEN_BYTES,
  EMAIL_VERIFICATION_TOKEN_LENGTH,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  generateEmailVerificationToken,
  isValidEmailVerificationTokenFormat,
  hashEmailVerificationToken,
  normalizeEmailForVerification,
  hashEmailVerificationAddress,
  getEmailVerificationExpiresAt,
  isValidSha256Hex,
};
