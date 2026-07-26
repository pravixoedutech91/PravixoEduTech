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

const DEFAULT_TENANT_ID = "pravixoedutech";

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
    const { name, mobile, email, password, tenantId, referralCode } = req.body;

    const resolvedTenantId = String(tenantId || DEFAULT_TENANT_ID).trim();
    const cleanMobile = normalizeMobile(mobile);
    const cleanEmail = normalizeEmail(email);

    const referralValidation = await validateReferralCodeForRegistration({
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
      $or: [{ mobile: cleanMobile }, { email: cleanEmail }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this mobile or email",
      });
    }

    const user = await User.create({
      name,
      mobile: cleanMobile,
      email: cleanEmail,
      password,
      tenantId: resolvedTenantId,
      role: "student",
    });

    const referralAttribution = await createReferralAttributionForStudent({
      tenantId: resolvedTenantId,
      studentId: user._id,
      partner: referralValidation.partner,
      referralCode: referralValidation.code,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        referral: referralAttribution
          ? {
              referralCode: referralAttribution.referralCode,
              referralPartnerId: referralAttribution.referralPartnerId,
              attributionId: referralAttribution._id,
            }
          : null,
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

// Login User
const loginUser = async (req, res) => {
  try {
    const { login, password, deviceInfo } = req.body;

    const user = await User.findOne({
      $or: [{ mobile: login }, { email: login }],
    }).select("+password");

    if (!user) {
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

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid login credentials",
      });
    }

    const sessionId = crypto.randomUUID();

    user.activeSessionId = sessionId;
    user.lastLoginAt = new Date();
    user.lastLoginDevice = deviceInfo || "";
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

// Create Initial Super Admin (Development Only)
const createSuperAdmin = async (req, res) => {
  try {
    const existingAdmin = await User.findOne({
      role: "super_admin",
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Super Admin already exists",
      });
    }

    const admin = await User.create({
      name: "Pravixo Super Admin",
      mobile: "9999999999",
      email: "admin@pravixo.com",
      password: "Admin@123",
      role: "super_admin",
      tenantId: DEFAULT_TENANT_ID,
      isEmailVerified: true,
    });

    res.status(201).json({
      success: true,
      message: "Super Admin created successfully",
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
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
  getMe,
  createSuperAdmin,
  createTenantAdmin,
};
