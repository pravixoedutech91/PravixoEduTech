const mongoose = require("mongoose");

const ReferralPartner = require("../models/ReferralPartner");

const adminRoles = ["super_admin", "tenant_admin"];

const hasText = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};


const toNumber = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
};

const normalizeCode = (value) => {
  if (!hasText(value)) {
    return "";
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 40);
};

const normalizeMobile = (value) => {
  return String(value || "").replace(/\D/g, "");
};

const getWriteTenantId = (req) => {
  if (req.user?.role === "super_admin") {
    return req.body?.tenantId || req.user?.tenantId;
  }

  return req.user?.tenantId;
};

const buildTenantFilter = (req) => {
  const filter = {};

  if (req.user?.role === "super_admin") {
    const tenantId = req.query?.tenantId || req.body?.tenantId;

    if (tenantId) {
      filter.tenantId = String(tenantId).trim();
    }

    return filter;
  }

  filter.tenantId = req.user?.tenantId;
  return filter;
};

const buildPartnerFilter = (req) => {
  const filter = {
    _id: req.params.id,
  };

  if (req.user?.role === "super_admin") {
    const tenantId = req.query?.tenantId || req.body?.tenantId;

    if (tenantId) {
      filter.tenantId = String(tenantId).trim();
    }

    return filter;
  }

  filter.tenantId = req.user?.tenantId;
  return filter;
};

const buildPartnerPayload = (partner) => {
  return {
    _id: partner._id,
    tenantId: partner.tenantId,
    name: partner.name,
    mobile: partner.mobile,
    email: partner.email,
    promoterType: partner.promoterType,
    code: partner.code,
    status: partner.status,
    commissionType: partner.commissionType,
    commissionValue: partner.commissionValue,
    walletBalanceInPaise: partner.walletBalanceInPaise,
    totalEarnedInPaise: partner.totalEarnedInPaise,
    totalWithdrawnInPaise: partner.totalWithdrawnInPaise,
    notes: partner.notes,
    createdBy: partner.createdBy,
    updatedBy: partner.updatedBy,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  };
};

const validateCommission = ({ commissionType, commissionValue }) => {
  if (!["flat", "percentage"].includes(commissionType)) {
    return "Invalid commission type";
  }

  if (!Number.isFinite(commissionValue) || commissionValue < 0) {
    return "Commission value must be a valid positive number";
  }

  if (commissionType === "percentage" && commissionValue > 100) {
    return "Percentage commission cannot be more than 100";
  }

  return "";
};

const buildCreateData = (req) => {
  const tenantId = String(getWriteTenantId(req) || "").trim();
  const name = hasText(req.body?.name) ? req.body.name.trim() : "";
  const mobile = normalizeMobile(req.body?.mobile);
  const email = hasText(req.body?.email) ? req.body.email.trim().toLowerCase() : "";
  const promoterType = req.body?.promoterType || "other";
  const code = normalizeCode(req.body?.code);
  const status = req.body?.status || "pending";
  const commissionType = req.body?.commissionType || "flat";
  const commissionValue = toNumber(req.body?.commissionValue, 0);

  if (!hasText(tenantId)) {
    return {
      error: "Valid tenantId is required",
    };
  }

  if (!name) {
    return {
      error: "Partner name is required",
    };
  }

  if (!/^[0-9]{10}$/.test(mobile)) {
    return {
      error: "Valid 10 digit mobile number is required",
    };
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return {
      error: "Valid email is required",
    };
  }

  if (
    ![
      "library",
      "cyber_cafe",
      "coaching",
      "teacher",
      "student",
      "influencer",
      "partner",
      "other",
    ].includes(promoterType)
  ) {
    return {
      error: "Invalid promoter type",
    };
  }

  if (!code || code.length < 4) {
    return {
      error: "Referral code must be at least 4 characters",
    };
  }

  if (!["pending", "active", "suspended", "rejected"].includes(status)) {
    return {
      error: "Invalid partner status",
    };
  }

  const commissionError = validateCommission({
    commissionType,
    commissionValue,
  });

  if (commissionError) {
    return {
      error: commissionError,
    };
  }

  return {
    data: {
      tenantId,
      name,
      mobile,
      email,
      promoterType,
      code,
      status,
      commissionType,
      commissionValue,
      walletBalanceInPaise: 0,
      totalEarnedInPaise: 0,
      totalWithdrawnInPaise: 0,
      notes: hasText(req.body?.notes) ? req.body.notes.trim() : "",
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    },
  };
};

const buildUpdateData = (req) => {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
    if (!hasText(req.body.name)) {
      return {
        error: "Partner name cannot be empty",
      };
    }

    data.name = req.body.name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "mobile")) {
    const mobile = normalizeMobile(req.body.mobile);

    if (!/^[0-9]{10}$/.test(mobile)) {
      return {
        error: "Valid 10 digit mobile number is required",
      };
    }

    data.mobile = mobile;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "email")) {
    const email = hasText(req.body.email)
      ? req.body.email.trim().toLowerCase()
      : "";

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return {
        error: "Valid email is required",
      };
    }

    data.email = email;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "promoterType")) {
    if (
      ![
        "library",
        "cyber_cafe",
        "coaching",
        "teacher",
        "student",
        "influencer",
        "partner",
        "other",
      ].includes(req.body.promoterType)
    ) {
      return {
        error: "Invalid promoter type",
      };
    }

    data.promoterType = req.body.promoterType;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "code")) {
    const code = normalizeCode(req.body.code);

    if (!code || code.length < 4) {
      return {
        error: "Referral code must be at least 4 characters",
      };
    }

    data.code = code;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    if (!["pending", "active", "suspended", "rejected"].includes(req.body.status)) {
      return {
        error: "Invalid partner status",
      };
    }

    data.status = req.body.status;
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body, "commissionType") ||
    Object.prototype.hasOwnProperty.call(req.body, "commissionValue")
  ) {
    const commissionType = Object.prototype.hasOwnProperty.call(
      req.body,
      "commissionType"
    )
      ? req.body.commissionType
      : undefined;

    const commissionValue = Object.prototype.hasOwnProperty.call(
      req.body,
      "commissionValue"
    )
      ? toNumber(req.body.commissionValue, Number.NaN)
      : undefined;

    if (commissionType !== undefined) {
      data.commissionType = commissionType;
    }

    if (commissionValue !== undefined) {
      data.commissionValue = commissionValue;
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
    data.notes = hasText(req.body.notes) ? req.body.notes.trim() : "";
  }


  const finalCommissionType = data.commissionType || req.body?.currentCommissionType;
  const finalCommissionValue =
    data.commissionValue !== undefined
      ? data.commissionValue
      : req.body?.currentCommissionValue;

  if (
    data.commissionType !== undefined ||
    data.commissionValue !== undefined
  ) {
    const commissionError = validateCommission({
      commissionType: finalCommissionType,
      commissionValue: finalCommissionValue,
    });

    if (commissionError) {
      return {
        error: commissionError,
      };
    }
  }

  data.updatedBy = req.user?._id;

  return {
    data,
  };
};

const getReferralPartners = async (req, res) => {
  try {
    const filter = buildTenantFilter(req);

    if (hasText(req.query?.status)) {
      filter.status = req.query.status;
    }

    if (hasText(req.query?.promoterType)) {
      filter.promoterType = req.query.promoterType;
    }

    if (hasText(req.query?.q)) {
      const q = req.query.q.trim();

      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { mobile: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
      ];
    }

    const page = Math.max(1, Math.trunc(Number(req.query?.page) || 1));
    const limit = Math.min(
      100,
      Math.max(1, Math.trunc(Number(req.query?.limit) || 20))
    );
    const skip = (page - 1) * limit;

    const [partners, total, summary] = await Promise.all([
      ReferralPartner.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReferralPartner.countDocuments(filter),
      ReferralPartner.aggregate([
        {
          $match: buildTenantFilter(req),
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summaryMap = {
      total: 0,
      pending: 0,
      active: 0,
      suspended: 0,
      rejected: 0,
    };

    summary.forEach((item) => {
      if (item._id && Object.prototype.hasOwnProperty.call(summaryMap, item._id)) {
        summaryMap[item._id] = item.count;
      }

      summaryMap.total += item.count;
    });

    return res.status(200).json({
      success: true,
      count: partners.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      summary: summaryMap,
      data: partners.map(buildPartnerPayload),
    });
  } catch (error) {
    console.error("Get referral partners error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral partners",
    });
  }
};

const getReferralPartnerById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid referral partner id",
      });
    }

    const partner = await ReferralPartner.findOne(buildPartnerFilter(req)).lean();

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Referral partner not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: buildPartnerPayload(partner),
    });
  } catch (error) {
    console.error("Get referral partner detail error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral partner",
    });
  }
};

const createReferralPartner = async (req, res) => {
  try {
    const built = buildCreateData(req);

    if (built.error) {
      return res.status(400).json({
        success: false,
        message: built.error,
      });
    }

    const partner = await ReferralPartner.create(built.data);

    return res.status(201).json({
      success: true,
      message: "Referral partner created successfully",
      data: buildPartnerPayload(partner),
    });
  } catch (error) {
    console.error("Create referral partner error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Referral code or mobile already exists for this tenant",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create referral partner",
    });
  }
};

const updateReferralPartner = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid referral partner id",
      });
    }

    const partner = await ReferralPartner.findOne(buildPartnerFilter(req));

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Referral partner not found",
      });
    }

    req.body.currentCommissionType = partner.commissionType;
    req.body.currentCommissionValue = partner.commissionValue;

    const built = buildUpdateData(req);

    if (built.error) {
      return res.status(400).json({
        success: false,
        message: built.error,
      });
    }

    Object.assign(partner, built.data);
    await partner.save();

    return res.status(200).json({
      success: true,
      message: "Referral partner updated successfully",
      data: buildPartnerPayload(partner),
    });
  } catch (error) {
    console.error("Update referral partner error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Referral code or mobile already exists for this tenant",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update referral partner",
    });
  }
};

const setReferralPartnerStatus = async (req, res, status) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid referral partner id",
      });
    }

    const partner = await ReferralPartner.findOne(buildPartnerFilter(req));

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Referral partner not found",
      });
    }

    partner.status = status;
    partner.updatedBy = req.user?._id;
    await partner.save();

    return res.status(200).json({
      success: true,
      message: `Referral partner ${status} successfully`,
      data: buildPartnerPayload(partner),
    });
  } catch (error) {
    console.error("Set referral partner status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update referral partner status",
    });
  }
};

const activateReferralPartner = (req, res) => {
  return setReferralPartnerStatus(req, res, "active");
};

const suspendReferralPartner = (req, res) => {
  return setReferralPartnerStatus(req, res, "suspended");
};

const rejectReferralPartner = (req, res) => {
  return setReferralPartnerStatus(req, res, "rejected");
};

module.exports = {
  adminRoles,
  getReferralPartners,
  getReferralPartnerById,
  createReferralPartner,
  updateReferralPartner,
  activateReferralPartner,
  suspendReferralPartner,
  rejectReferralPartner,
};

