const hasText = (value) => {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
};

const normalizeMobile = (value) => {
  return String(value || "").replace(/\D/g, "");
};

const normalizeEmail = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const normalizeName = (value) => {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
};

const normalizeRegistrationDeviceInfo = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 200);
};

const isValidEmail = (value) => {
  if (
    !value ||
    value.length > 254 ||
    value.includes(" ")
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const validatePublicStudentRegistration = (
  req,
  res,
  next
) => {
  const body =
    req && req.body && typeof req.body === "object"
      ? req.body
      : {};

  const name = normalizeName(body.name);
  const mobile = normalizeMobile(body.mobile);
  const email = normalizeEmail(body.email);
  const password =
    typeof body.password === "string"
      ? body.password
      : "";

  const referralCode = hasText(body.referralCode)
    ? body.referralCode.trim()
    : "";

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({
      success: false,
      message:
        "Name must be between 2 and 100 characters",
    });
  }

  if (!/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message:
        "Mobile number must be exactly 10 digits",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be at least 8 characters",
    });
  }

  if (
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Password is too long",
    });
  }

  req.registrationInput = {
    name,
    mobile,
    email,
    password,
    referralCode,
  };

  req.registrationSessionContext = {
    deviceInfo:
      normalizeRegistrationDeviceInfo(
        body.deviceInfo
      ),
  };

  next();
};

module.exports = {
  normalizeMobile,
  normalizeEmail,
  normalizeName,
  normalizeRegistrationDeviceInfo,
  isValidEmail,
  validatePublicStudentRegistration,
};