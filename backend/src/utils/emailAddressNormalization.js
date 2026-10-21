/*
 * Provider-neutral account email normalization.
 *
 * IMPORTANT:
 * Preserve the existing account-side normalization
 * behavior during transactional-email provider migration.
 *
 * Do not silently tighten this helper to the transport
 * sender/recipient policy. Email-policy hardening must be
 * reviewed as a separate authentication/account change.
 */

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

module.exports = {
  normalizeSingleEmailAddress,
};
