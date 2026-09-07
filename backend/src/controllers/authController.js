const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const Tenant = require("../models/Tenant");
const ReferralPartner = require("../models/ReferralPartner");
const ReferralAttribution = require("../models/ReferralAttribution");
const ReferralSettings = require("../models/ReferralSettings");

const {
  RESET_PASSWORD_RESULT_CODES,
  requestStudentPasswordReset,
  resetStudentPassword,
} = require("../services/passwordResetService");

const {
  buildStudentPasswordResetUrl,
} = require("../services/passwordResetLinkService");

const {
  sendPasswordResetEmail,
} = require("../services/passwordResetEmailService");

const {
  EMAIL_VERIFICATION_RESULT_CODES,
  issueStudentEmailVerification,
  requestStudentEmailVerification,
  verifyStudentEmail,
} = require(
  "../services/emailVerificationService"
);

const {
  buildStudentEmailVerificationUrl,
} = require(
  "../services/emailVerificationLinkService"
);

const {
  sendEmailVerificationEmail,
} = require(
  "../services/emailVerificationEmailService"
);

const REGISTRATION_EMAIL_VERIFICATION_REQUIRED_CODE =
  "EMAIL_VERIFICATION_REQUIRED";

const REGISTRATION_EMAIL_VERIFICATION_SENT_MESSAGE =
  "Account created successfully. Please verify your email before signing in.";

const REGISTRATION_EMAIL_VERIFICATION_PENDING_MESSAGE =
  "Account created successfully, but the verification email could not be sent. Please request a new verification email.";
const LOGIN_EMAIL_VERIFICATION_REQUIRED_CODE =
  "EMAIL_VERIFICATION_REQUIRED";

const LOGIN_EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Please verify your email before signing in.";
const PASSWORD_RESET_REQUEST_GENERIC_MESSAGE =
  "If an eligible account exists, password reset instructions have been sent.";

const PASSWORD_RESET_INVALID_OR_EXPIRED_MESSAGE =
  "This password reset link is invalid or has expired. Please request a new one.";

const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Password reset successfully. Please sign in again.";
const EMAIL_VERIFICATION_REQUEST_GENERIC_MESSAGE =
  "If an eligible account exists, email verification instructions have been sent.";

const EMAIL_VERIFICATION_INVALID_OR_EXPIRED_MESSAGE =
  "This email verification link is invalid or has expired. Please request a new one.";

const EMAIL_VERIFICATION_SUCCESS_MESSAGE =
  "Email verified successfully. Please sign in.";

const generateToken = (user, sessionId) => {
  return jwt.sign(
    {
      id: user._id,
      tenantId: user.tenantId,
      role: user.role,
      sessionId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const hasText = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const normalizeMobile = (value) => {
  return String(value || "").replace(/\D/g, "");
};

const normalizeEmail = (value) => {
  return String(value || "").trim().toLowerCase();
};

const normalizeReferralCode = (value) => {
  if (!hasText(value)) {
    return "";
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 40);
};

const validateReferralCodeForRegistration = async ({
  tenantId,
  referralCode,
  mobile,
  email,
}) => {
  const code = normalizeReferralCode(referralCode);

  if (!code) {
    return {
      code: "",
      partner: null,
    };
  }

  if (code.length < 4) {
    return {
      error: "Referral code must be at least 4 characters",
    };
  }

  const tenant = await Tenant.findOne({
    slug: tenantId,
  }).lean();

  if (!tenant) {
    return {
      error: "Tenant not found for referral code",
    };
  }

  if (!tenant.isActive) {
    return {
      error: "Tenant is inactive for referral code",
    };
  }

  if (!tenant.features?.referrals) {
    return {
      error: "Referral program is not enabled for this tenant",
    };
  }

  const referralSettings = await ReferralSettings.findOne({
    tenantId,
  }).lean();

  if (!referralSettings?.isReferralEnabled) {
    return {
      error: "Referral program is currently disabled",
    };
  }

  const partner = await ReferralPartner.findOne({
    tenantId,
    code,
    status: "active",
  }).lean();

  if (!partner) {
    return {
      error: "Invalid or inactive referral code",
    };
  }

  const cleanMobile = normalizeMobile(mobile);
  const cleanEmail = normalizeEmail(email);
  const partnerEmail = normalizeEmail(partner.email);

  if (partner.mobile && partner.mobile === cleanMobile) {
    return {
      error: "Self-referral is not allowed",
    };
  }

  if (partnerEmail && cleanEmail && partnerEmail === cleanEmail) {
    return {
      error: "Self-referral is not allowed",
    };
  }

  return {
    code,
    partner,
  };
};

const createReferralAttributionForStudent = async ({
  tenantId,
  studentId,
  partner,
  referralCode,
}) => {
  if (!partner || !referralCode) {
    return null;
  }

  try {
    return await ReferralAttribution.create({
      tenantId,
      studentId,
      referralPartnerId: partner._id,
      referralCode,
      source: "register",
      attributedAt: new Date(),
      lockedAt: new Date(),
      status: "active",
    });
  } catch (error) {
    logRuntimeError("Referral attribution creation failed:", error);

    return null;
  }
};

// Register User
const registerUser = async (req, res) => {
  try {
    const registrationInput = req.registrationInput;

    if (!registrationInput) {
      return res.status(500).json({
        success: false,
        message: "Registration is currently unavailable",
      });
    }

    const {
      name,
      mobile,
      email,
      password,
      referralCode,
    } = registrationInput;

    const resolvedTenantId = String(
      req.registrationTenantId || ""
    ).trim();

    if (!resolvedTenantId) {
      return res.status(503).json({
        success: false,
        message: "Registration is currently unavailable",
      });
    }

    const cleanMobile = normalizeMobile(mobile);
    const cleanEmail = normalizeEmail(email);

    const referralValidation =
      await validateReferralCodeForRegistration({
        tenantId: resolvedTenantId,
        referralCode,
        mobile: cleanMobile,
        email: cleanEmail,
      });

    if (referralValidation.error) {
      return res.status(400).json({
        success: false,
        message: referralValidation.error,
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { mobile: cleanMobile },
        { email: cleanEmail },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this mobile or email",
      });
    }

    /*
     * Registration creates account identity only.
     * Authentication begins only after mailbox verification
     * followed by an explicit sign-in.
     */
    const user = await User.create({
      name,
      mobile: cleanMobile,
      email: cleanEmail,
      password,
      tenantId: resolvedTenantId,
      role: "student",
      isActive: true,
      isEmailVerified: false,
      activeSessionId: "",
      lastLoginAt: null,
      lastLoginDevice: "",
    });

    /*
     * Preserve existing referral semantics.
     * Attribution remains tied to account creation,
     * not to email delivery or later verification.
     */
    const referralAttribution =
      await createReferralAttributionForStudent({
        tenantId: resolvedTenantId,
        studentId: user._id,
        partner: referralValidation.partner,
        referralCode: referralValidation.code,
      });

    let verificationEmailSent = false;

    try {
      const verificationResult =
        await issueStudentEmailVerification({
          user,
          enforceCooldown: false,

          deliverVerification: async ({
            toEmail,
            rawToken,
            expiresAt,
          }) => {
            const verificationUrl =
              buildStudentEmailVerificationUrl({
                rawToken,
              });

            await sendEmailVerificationEmail({
              toEmail,
              verificationUrl,
              expiresAt,
            });
          },
        });

      verificationEmailSent =
        verificationResult?.success === true &&
        verificationResult?.code ===
          EMAIL_VERIFICATION_RESULT_CODES.ISSUED;

      if (!verificationEmailSent) {
        logRuntimeError(
          "Registration email verification issuance unavailable:",
          {
            name: "EmailVerificationRegistrationError",
            type: "email_verification_registration_not_issued",
          }
        );
      }
    } catch (error) {
      /*
       * The account is already valid pending identity.
       * A delivery/configuration outage must not delete it
       * or create an authenticated session.
       */
      logRuntimeError(
        "Registration email verification delivery failed:",
        error
      );
    }

    res.status(201).json({
      success: true,
      code:
        REGISTRATION_EMAIL_VERIFICATION_REQUIRED_CODE,
      message: verificationEmailSent
        ? REGISTRATION_EMAIL_VERIFICATION_SENT_MESSAGE
        : REGISTRATION_EMAIL_VERIFICATION_PENDING_MESSAGE,
      data: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        emailVerificationRequired: true,
        verificationEmailSent,
        referral: referralAttribution
          ? {
              referralCode:
                referralAttribution.referralCode,
              referralPartnerId:
                referralAttribution.referralPartnerId,
              attributionId:
                referralAttribution._id,
            }
          : null,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this mobile or email",
      });
    }

    logRuntimeError("authController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { login, password, deviceInfo } = req.body;

    const rawLogin =
      typeof login === "string"
        ? login.trim()
        : "";

    const normalizedLogin =
      rawLogin.includes("@")
        ? normalizeEmail(rawLogin)
        : normalizeMobile(rawLogin);

    const cleanDeviceInfo =
      typeof deviceInfo === "string"
        ? deviceInfo.trim().slice(0, 200)
        : "";

    if (
      !normalizedLogin ||
      !hasText(password)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials",
      });
    }

    const user = await User.findOne({
      $or: [
        { mobile: normalizedLogin },
        { email: normalizedLogin },
      ],
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials",
      });
    }

    /*
     * Validate the password before exposing account state.
     * This prevents inactive/unverified status disclosure to
     * a caller who does not possess valid credentials.
     */
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    if (
      user.role === "student" &&
      user.isEmailVerified !== true
    ) {
      return res.status(403).json({
        success: false,
        code:
          LOGIN_EMAIL_VERIFICATION_REQUIRED_CODE,
        message:
          LOGIN_EMAIL_VERIFICATION_REQUIRED_MESSAGE,
      });
    }

    const sessionId = crypto.randomUUID();

    user.activeSessionId = sessionId;
    user.lastLoginAt = new Date();
    user.lastLoginDevice = cleanDeviceInfo;
    await user.save();

    const token = generateToken(user, sessionId);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
    });
  } catch (error) {
    logRuntimeError("authController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

// Forgot Student Password
const forgotPassword = async (req, res) => {
  try {
    const login =
      req &&
      req.body &&
      typeof req.body === "object"
        ? req.body.login
        : undefined;

    await requestStudentPasswordReset({
      login,

      deliverReset: async ({
        toEmail,
        rawToken,
        expiresAt,
      }) => {
        const resetUrl =
          buildStudentPasswordResetUrl({
            rawToken,
          });

        await sendPasswordResetEmail({
          toEmail,
          resetUrl,
          expiresAt,
        });
      },
    });
  } catch (error) {
    /*
     * Always expose the same public response for
     * unknown/ineligible accounts, cooldown, DB
     * failure, reset-link failure and mail failure.
     */
    logRuntimeError("Password reset request failed:", error);
  }

  return res.status(200).json({
    success: true,
    message:
      PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
  });
};

// Reset Student Password
const resetPassword = async (req, res) => {
  try {
    const body =
      req &&
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};

    const result =
      await resetStudentPassword({
        rawToken:
          body.token,

        newPassword:
          body.password,
      });

    if (
      result &&
      result.success === true &&
      result.code ===
        RESET_PASSWORD_RESULT_CODES.SUCCESS
    ) {
      return res.status(200).json({
        success: true,
        message:
          PASSWORD_RESET_SUCCESS_MESSAGE,
      });
    }

    if (
      result &&
      result.code ===
        RESET_PASSWORD_RESULT_CODES.INVALID_PASSWORD
    ) {
      return res.status(400).json({
        success: false,
        message:
          typeof result.message === "string" &&
          result.message
            ? result.message
            : "Invalid password",
      });
    }

    if (
      result &&
      result.code ===
        RESET_PASSWORD_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
    ) {
      return res.status(400).json({
        success: false,
        message:
          PASSWORD_RESET_INVALID_OR_EXPIRED_MESSAGE,
      });
    }

    throw new Error(
      "Unexpected password reset result"
    );
  } catch (error) {
    logRuntimeError("Password reset failed:", error);

    return res.status(500).json({
      success: false,
      message:
        getInternalErrorMessage(error),
    });
  }
};
// Resend Student Email Verification
const resendEmailVerification = async (req, res) => {
  try {
    const login =
      req &&
      req.body &&
      typeof req.body === "object"
        ? req.body.login
        : undefined;

    await requestStudentEmailVerification({
      login,

      deliverVerification: async ({
        toEmail,
        rawToken,
        expiresAt,
      }) => {
        const verificationUrl =
          buildStudentEmailVerificationUrl({
            rawToken,
          });

        await sendEmailVerificationEmail({
          toEmail,
          verificationUrl,
          expiresAt,
        });
      },
    });
  } catch (error) {
    /*
     * Preserve one generic public response for unknown,
     * ineligible, already-verified and cooling-down accounts,
     * as well as DB/link/provider failures.
     */
    logRuntimeError("Email verification request failed:", error);
  }

  return res.status(200).json({
    success: true,
    message:
      EMAIL_VERIFICATION_REQUEST_GENERIC_MESSAGE,
  });
};

// Verify Student Email
const verifyEmail = async (req, res) => {
  try {
    const body =
      req &&
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};

    const result =
      await verifyStudentEmail({
        rawToken:
          body.token,
      });

    if (
      result &&
      result.success === true &&
      (
        result.code ===
          EMAIL_VERIFICATION_RESULT_CODES.VERIFIED ||
        result.code ===
          EMAIL_VERIFICATION_RESULT_CODES
            .ALREADY_VERIFIED
      )
    ) {
      return res.status(200).json({
        success: true,
        message:
          EMAIL_VERIFICATION_SUCCESS_MESSAGE,
      });
    }

    if (
      result &&
      result.code ===
        EMAIL_VERIFICATION_RESULT_CODES
          .INVALID_OR_EXPIRED_TOKEN
    ) {
      return res.status(400).json({
        success: false,
        message:
          EMAIL_VERIFICATION_INVALID_OR_EXPIRED_MESSAGE,
      });
    }

    throw new Error(
      "Unexpected email verification result"
    );
  } catch (error) {
    logRuntimeError("Email verification failed:", error);

    return res.status(500).json({
      success: false,
      message:
        getInternalErrorMessage(error),
    });
  }
};

// Get Logged In User Profile
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name,
      mobile: req.user.mobile,
      email: req.user.email,
      tenantId: req.user.tenantId,
      role: req.user.role,
    },
  });
};

// Create Tenant Admin
const createTenantAdmin = async (req, res) => {
  try {
    const { name, mobile, email, password, tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "tenantId is required",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ mobile }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this mobile or email",
      });
    }

    const tenantAdmin = await User.create({
      name,
      mobile,
      email,
      password,
      tenantId,
      role: "tenant_admin",
      isEmailVerified: true,
    });

    res.status(201).json({
      success: true,
      message: "Tenant Admin created successfully",
      data: {
        id: tenantAdmin._id,
        name: tenantAdmin.name,
        mobile: tenantAdmin.mobile,
        email: tenantAdmin.email,
        tenantId: tenantAdmin.tenantId,
        role: tenantAdmin.role,
      },
    });
  } catch (error) {
    logRuntimeError("authController error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  resendEmailVerification,
  verifyEmail,
  getMe,
  createTenantAdmin,
};
