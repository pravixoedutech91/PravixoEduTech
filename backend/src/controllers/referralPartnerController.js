const { logRuntimeError } = require("../utils/runtimeSecurity");
const mongoose = require("mongoose");

const ReferralPartner = require("../models/ReferralPartner");
const ReferralAttribution = require("../models/ReferralAttribution");
const ReferralReward = require("../models/ReferralReward");
const ReferralSettings = require("../models/ReferralSettings");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const User = require("../models/User");
const Purchase = require("../models/Purchase");

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

const buildAttributionSummary = (summaryRows) => {
  const summary = {
    total: 0,
    active: 0,
    cancelled: 0,
  };

  for (const row of summaryRows || []) {
    const status = row._id || "active";
    const count = row.count || 0;

    summary.total += count;

    if (Object.prototype.hasOwnProperty.call(summary, status)) {
      summary[status] = count;
    }
  }

  return summary;
};

const buildAttributionStudentPayload = (student) => {
  if (!student) {
    return null;
  }

  return {
    _id: student._id,
    name: student.name,
    mobile: student.mobile,
    email: student.email,
    tenantId: student.tenantId,
    role: student.role,
    isActive: student.isActive,
    createdAt: student.createdAt,
  };
};

const buildAttributionPartnerPayload = (partner) => {
  if (!partner) {
    return null;
  }

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
  };
};

const buildAttributionPayload = ({ attribution, student, partner }) => {
  return {
    _id: attribution._id,
    tenantId: attribution.tenantId,
    studentId: attribution.studentId,
    referralPartnerId: attribution.referralPartnerId,
    referralCode: attribution.referralCode,
    source: attribution.source,
    attributedAt: attribution.attributedAt,
    lockedAt: attribution.lockedAt,
    status: attribution.status,
    cancelledAt: attribution.cancelledAt,
    cancellationReason: attribution.cancellationReason,
    student: buildAttributionStudentPayload(student),
    partner: buildAttributionPartnerPayload(partner),
    createdAt: attribution.createdAt,
    updatedAt: attribution.updatedAt,
  };
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


const getReferralAttributions = async (req, res) => {
  try {
    const page = Math.max(1, Math.trunc(Number(req.query?.page) || 1));
    const limit = Math.min(
      100,
      Math.max(1, Math.trunc(Number(req.query?.limit) || 50))
    );
    const skip = (page - 1) * limit;

    const filter = buildTenantFilter(req);

    if (hasText(req.query?.status)) {
      const status = req.query.status.trim();

      if (!["active", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid attribution status",
        });
      }

      filter.status = status;
    }

    if (hasText(req.query?.referralCode)) {
      const referralCode = normalizeReferralCode(req.query.referralCode);

      if (!referralCode) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code",
        });
      }

      filter.referralCode = referralCode;
    }

    if (hasText(req.query?.referralPartnerId)) {
      if (!isValidObjectId(req.query.referralPartnerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral partner id",
        });
      }

      filter.referralPartnerId = new mongoose.Types.ObjectId(req.query.referralPartnerId);
    }

    if (hasText(req.query?.studentId)) {
      if (!isValidObjectId(req.query.studentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid student id",
        });
      }

      filter.studentId = new mongoose.Types.ObjectId(req.query.studentId);
    }

    const summaryFilter = { ...filter };

    const [total, attributions, summaryRows] = await Promise.all([
      ReferralAttribution.countDocuments(filter),
      ReferralAttribution.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReferralAttribution.aggregate([
        {
          $match: summaryFilter,
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const studentIds = [
      ...new Set(attributions.map((item) => String(item.studentId))),
    ];
    const partnerIds = [
      ...new Set(attributions.map((item) => String(item.referralPartnerId))),
    ];

    const [students, partners] = await Promise.all([
      studentIds.length > 0
        ? User.find({
            _id: {
              $in: studentIds,
            },
          })
            .select("name mobile email tenantId role isActive createdAt")
            .lean()
        : [],
      partnerIds.length > 0
        ? ReferralPartner.find({
            _id: {
              $in: partnerIds,
            },
          })
            .select(
              "tenantId name mobile email promoterType code status commissionType commissionValue"
            )
            .lean()
        : [],
    ]);

    const studentById = new Map(
      students.map((student) => [String(student._id), student])
    );
    const partnerById = new Map(
      partners.map((partner) => [String(partner._id), partner])
    );

    const data = attributions.map((attribution) =>
      buildAttributionPayload({
        attribution,
        student: studentById.get(String(attribution.studentId)),
        partner: partnerById.get(String(attribution.referralPartnerId)),
      })
    );

    return res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: buildAttributionSummary(summaryRows),
      data,
    });
  } catch (error) {
    logRuntimeError("Get referral attributions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral attributions",
    });
  }
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
    logRuntimeError("Get referral partners error:", error);

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
    logRuntimeError("Get referral partner detail error:", error);

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
    logRuntimeError("Create referral partner error:", error);

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
    logRuntimeError("Update referral partner error:", error);

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
    logRuntimeError("Set referral partner status error:", error);

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


const rewardLedgerStatuses = [
  "pending",
  "approved",
  "rejected",
  "withdrawal_requested",
  "paid",
  "reversed",
];

const t45hToInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
};

const t45hIsValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
};

const buildReferralRewardTenantFilter = (req) => {
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

const buildReferralRewardSummary = (summaryRows) => {
  const summary = {
    total: {
      count: 0,
      purchaseAmountInPaise: 0,
      rewardAmountInPaise: 0,
    },
    pending: {
      count: 0,
      purchaseAmountInPaise: 0,
      rewardAmountInPaise: 0,
    },
    approved: {
      count: 0,
      purchaseAmountInPaise: 0,
      rewardAmountInPaise: 0,
    },
    rejected: {
      count: 0,
      purchaseAmountInPaise: 0,
      rewardAmountInPaise: 0,
    },
    withdrawal_requested: {
      count: 0,
      purchaseAmountInPaise: 0,
      rewardAmountInPaise: 0,
    },
    paid: {
      count: 0,
      purchaseAmountInPaise: 0,
      rewardAmountInPaise: 0,
    },
    reversed: {
      count: 0,
      purchaseAmountInPaise: 0,
      rewardAmountInPaise: 0,
    },
  };

  for (const row of summaryRows || []) {
    const status = row._id || "pending";
    const count = row.count || 0;
    const purchaseAmountInPaise = row.purchaseAmountInPaise || 0;
    const rewardAmountInPaise = row.rewardAmountInPaise || 0;

    summary.total.count += count;
    summary.total.purchaseAmountInPaise += purchaseAmountInPaise;
    summary.total.rewardAmountInPaise += rewardAmountInPaise;

    if (summary[status]) {
      summary[status].count = count;
      summary[status].purchaseAmountInPaise = purchaseAmountInPaise;
      summary[status].rewardAmountInPaise = rewardAmountInPaise;
    }
  }

  return summary;
};

const buildReferralRewardStudentPayload = (student) => {
  if (!student) {
    return null;
  }

  return {
    _id: student._id,
    name: student.name,
    email: student.email,
    mobile: student.mobile,
    role: student.role,
    tenantId: student.tenantId,
  };
};

const buildReferralRewardPartnerPayload = (partner) => {
  if (!partner) {
    return null;
  }

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
  };
};

const buildReferralRewardPurchasePayload = (purchase) => {
  if (!purchase) {
    return null;
  }

  return {
    _id: purchase._id,
    tenantId: purchase.tenantId,
    studentId: purchase.studentId,
    productId: purchase.productId,
    productSnapshot: purchase.productSnapshot,
    amountInPaise: purchase.amountInPaise,
    currency: purchase.currency,
    status: purchase.status,
    provider: purchase.provider,
    receipt: purchase.receipt,
    razorpayOrderId: purchase.razorpayOrderId,
    razorpayPaymentId: purchase.razorpayPaymentId,
    paidAt: purchase.paidAt,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
  };
};

const getReferralRewards = async (req, res) => {
  try {
    const page = Math.max(t45hToInteger(req.query.page, 1), 1);
    const limit = Math.min(Math.max(t45hToInteger(req.query.limit, 50), 1), 100);
    const skip = (page - 1) * limit;

    const filter = buildReferralRewardTenantFilter(req);

    if (req.query.status) {
      const status = String(req.query.status).trim();

      if (!rewardLedgerStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid reward status",
        });
      }

      filter.status = status;
    }

    if (req.query.referralPartnerId) {
      if (!t45hIsValidObjectId(req.query.referralPartnerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid referralPartnerId",
        });
      }

      filter.referralPartnerId = new mongoose.Types.ObjectId(
        req.query.referralPartnerId
      );
    }

    if (req.query.studentId) {
      if (!t45hIsValidObjectId(req.query.studentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid studentId",
        });
      }

      filter.studentId = new mongoose.Types.ObjectId(req.query.studentId);
    }

    if (req.query.purchaseId) {
      if (!t45hIsValidObjectId(req.query.purchaseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid purchaseId",
        });
      }

      filter.purchaseId = new mongoose.Types.ObjectId(req.query.purchaseId);
    }

    const [total, rewards, summaryRows] = await Promise.all([
      ReferralReward.countDocuments(filter),
      ReferralReward.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReferralReward.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
            purchaseAmountInPaise: {
              $sum: "$purchaseAmountInPaise",
            },
            rewardAmountInPaise: {
              $sum: "$rewardAmountInPaise",
            },
          },
        },
      ]),
    ]);

    const partnerIds = [
      ...new Set(rewards.map((reward) => String(reward.referralPartnerId))),
    ];
    const studentIds = [
      ...new Set(rewards.map((reward) => String(reward.studentId))),
    ];
    const purchaseIds = rewards.map((reward) => reward.purchaseId);

    const [partners, students, purchases] = await Promise.all([
      partnerIds.length > 0
        ? ReferralPartner.find({
            _id: {
              $in: partnerIds,
            },
          })
            .select(
              "tenantId name mobile email promoterType code status commissionType commissionValue"
            )
            .lean()
        : [],
      studentIds.length > 0
        ? User.find({
            _id: {
              $in: studentIds,
            },
          })
            .select("name email mobile role tenantId")
            .lean()
        : [],
      purchaseIds.length > 0
        ? Purchase.find({
            _id: {
              $in: purchaseIds,
            },
          })
            .select(
              "tenantId studentId productId productSnapshot amountInPaise currency status provider receipt razorpayOrderId razorpayPaymentId paidAt createdAt updatedAt"
            )
            .lean()
        : [],
    ]);

    const partnerById = new Map(
      partners.map((partner) => [String(partner._id), partner])
    );
    const studentById = new Map(
      students.map((student) => [String(student._id), student])
    );
    const purchaseById = new Map(
      purchases.map((purchase) => [String(purchase._id), purchase])
    );

    const data = rewards.map((reward) => {
      const partner = partnerById.get(String(reward.referralPartnerId));
      const student = studentById.get(String(reward.studentId));
      const purchase = purchaseById.get(String(reward.purchaseId));

      return {
        _id: reward._id,
        tenantId: reward.tenantId,
        referralPartnerId: reward.referralPartnerId,
        studentId: reward.studentId,
        purchaseId: reward.purchaseId,
        productId: reward.productId,
        referralPartner: buildReferralRewardPartnerPayload(partner),
        student: buildReferralRewardStudentPayload(student),
        purchase: buildReferralRewardPurchasePayload(purchase),
        purchaseAmountInPaise: reward.purchaseAmountInPaise,
        purchaseAmountInRupees: Number(
          ((reward.purchaseAmountInPaise || 0) / 100).toFixed(2)
        ),
        rewardAmountInPaise: reward.rewardAmountInPaise,
        rewardAmountInRupees: Number(
          ((reward.rewardAmountInPaise || 0) / 100).toFixed(2)
        ),
        status: reward.status,
        approvedAt: reward.approvedAt,
        rejectedAt: reward.rejectedAt,
        withdrawalRequestedAt: reward.withdrawalRequestedAt,
        paidAt: reward.paidAt,
        reversedAt: reward.reversedAt,
        rejectionReason: reward.rejectionReason,
        reversalReason: reward.reversalReason,
        createdAt: reward.createdAt,
        updatedAt: reward.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: buildReferralRewardSummary(summaryRows),
      data,
    });
  } catch (error) {
    logRuntimeError("Get referral rewards error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch referral rewards",
    });
  }
};


const buildRewardMutationResponse = (reward, partner) => {
  return {
    reward,
    referralPartner: partner
      ? {
          _id: partner._id,
          tenantId: partner.tenantId,
          name: partner.name,
          mobile: partner.mobile,
          email: partner.email,
          promoterType: partner.promoterType,
          code: partner.code,
          status: partner.status,
          walletBalanceInPaise: partner.walletBalanceInPaise,
          totalEarnedInPaise: partner.totalEarnedInPaise,
          totalWithdrawnInPaise: partner.totalWithdrawnInPaise,
        }
      : null,
  };
};

const buildRewardMutationFilter = (req) => {
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

const approveReferralReward = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reward id",
      });
    }

    const reward = await ReferralReward.findOne(buildRewardMutationFilter(req));

    if (!reward) {
      return res.status(404).json({
        success: false,
        message: "Referral reward not found or access denied",
      });
    }

    if (reward.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending rewards can be approved",
      });
    }

    const partner = await ReferralPartner.findOneAndUpdate(
      {
        _id: reward.referralPartnerId,
        tenantId: reward.tenantId,
      },
      {
        $inc: {
          walletBalanceInPaise: reward.rewardAmountInPaise,
          totalEarnedInPaise: reward.rewardAmountInPaise,
        },
        $set: {
          updatedBy: req.user?._id,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Referral partner not found for this reward",
      });
    }

    reward.status = "approved";
    reward.approvedAt = new Date();
    reward.adminNote = hasText(req.body?.adminNote)
      ? String(req.body.adminNote).trim()
      : reward.adminNote;
    reward.updatedBy = req.user?._id;

    await reward.save();

    return res.status(200).json({
      success: true,
      message: "Referral reward approved successfully",
      data: buildRewardMutationResponse(reward, partner),
    });
  } catch (error) {
    logRuntimeError("Approve referral reward error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve referral reward",
    });
  }
};

const rejectReferralReward = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reward id",
      });
    }

    const reward = await ReferralReward.findOne(buildRewardMutationFilter(req));

    if (!reward) {
      return res.status(404).json({
        success: false,
        message: "Referral reward not found or access denied",
      });
    }

    if (reward.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending rewards can be rejected",
      });
    }

    const adminNote = hasText(req.body?.adminNote)
      ? String(req.body.adminNote).trim()
      : "";

    if (!adminNote) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    reward.status = "rejected";
    reward.rejectedAt = new Date();
    reward.adminNote = adminNote;
    reward.updatedBy = req.user?._id;

    await reward.save();

    const partner = await ReferralPartner.findOne({
      _id: reward.referralPartnerId,
      tenantId: reward.tenantId,
    });

    return res.status(200).json({
      success: true,
      message: "Referral reward rejected successfully",
      data: buildRewardMutationResponse(reward, partner),
    });
  } catch (error) {
    logRuntimeError("Reject referral reward error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject referral reward",
    });
  }
};


const withdrawalPayoutMethods = ["upi", "bank", "cash", "other"];

const normalizePayoutMethod = (value) => {
  const method = String(value || "upi").trim().toLowerCase();
  return withdrawalPayoutMethods.includes(method) ? method : "";
};

const buildWithdrawalPartnerFilter = (req) => {
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

const buildBankDetailsSnapshot = (value) => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const accountNumber = String(value.accountNumber || value.accountNumberLast4 || "")
    .replace(/\D/g, "");
  const accountNumberLast4 = accountNumber ? accountNumber.slice(-4) : "";

  const snapshot = {
    accountHolderName: hasText(value.accountHolderName)
      ? String(value.accountHolderName).trim()
      : undefined,
    accountNumberLast4,
    ifsc: hasText(value.ifsc) ? String(value.ifsc).trim().toUpperCase() : undefined,
    bankName: hasText(value.bankName) ? String(value.bankName).trim() : undefined,
  };

  Object.keys(snapshot).forEach((key) => {
    if (!snapshot[key]) {
      delete snapshot[key];
    }
  });

  return Object.keys(snapshot).length ? snapshot : undefined;
};

const buildWithdrawalResponse = (withdrawal, partner) => {
  return {
    withdrawalRequest: withdrawal
      ? {
          _id: withdrawal._id,
          tenantId: withdrawal.tenantId,
          referralPartnerId: withdrawal.referralPartnerId,
          amountInPaise: withdrawal.amountInPaise,
          amountInRupees: Number(((withdrawal.amountInPaise || 0) / 100).toFixed(2)),
          status: withdrawal.status,
          payoutMethod: withdrawal.payoutMethod,
          upiId: withdrawal.upiId,
          bankDetailsSnapshot: withdrawal.bankDetailsSnapshot,
          requestedAt: withdrawal.requestedAt,
          approvedAt: withdrawal.approvedAt,
          rejectedAt: withdrawal.rejectedAt,
          paidAt: withdrawal.paidAt,
          cancelledAt: withdrawal.cancelledAt,
          adminNote: withdrawal.adminNote,
          createdAt: withdrawal.createdAt,
          updatedAt: withdrawal.updatedAt,
        }
      : null,
    referralPartner: partner
      ? {
          _id: partner._id,
          tenantId: partner.tenantId,
          name: partner.name,
          mobile: partner.mobile,
          email: partner.email,
          promoterType: partner.promoterType,
          code: partner.code,
          status: partner.status,
          walletBalanceInPaise: partner.walletBalanceInPaise,
          totalEarnedInPaise: partner.totalEarnedInPaise,
          totalWithdrawnInPaise: partner.totalWithdrawnInPaise,
        }
      : null,
  };
};

const createPartnerWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid referral partner id",
      });
    }

    const amountInPaise = Number.parseInt(req.body?.amountInPaise, 10);

    if (!Number.isFinite(amountInPaise) || amountInPaise < 1) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal amount must be greater than zero",
      });
    }

    const payoutMethod = normalizePayoutMethod(req.body?.payoutMethod);

    if (!payoutMethod) {
      return res.status(400).json({
        success: false,
        message: "Invalid payout method",
      });
    }

    const upiId = hasText(req.body?.upiId)
      ? String(req.body.upiId).trim().toLowerCase()
      : "";

    if (payoutMethod === "upi" && !upiId) {
      return res.status(400).json({
        success: false,
        message: "UPI ID is required for UPI withdrawal",
      });
    }

    const partnerFilter = buildWithdrawalPartnerFilter(req);
    let savedWithdrawal = null;
    let updatedPartner = null;

    await session.withTransaction(async () => {
      const partner = await ReferralPartner.findOne(partnerFilter).session(session);

      if (!partner) {
        const error = new Error("Referral partner not found or access denied");
        error.statusCode = 404;
        throw error;
      }

      if (partner.status !== "active") {
        const error = new Error("Only active referral partners can request withdrawal");
        error.statusCode = 400;
        throw error;
      }

      const settings =
        (await ReferralSettings.findOne({ tenantId: partner.tenantId }).session(session)) ||
        null;

      const minimumWithdrawalAmountInPaise =
        settings?.minimumWithdrawalAmountInPaise ?? 0;

      if (
        minimumWithdrawalAmountInPaise > 0 &&
        amountInPaise < minimumWithdrawalAmountInPaise
      ) {
        const error = new Error(
          "Withdrawal amount is below minimum withdrawal limit"
        );
        error.statusCode = 400;
        throw error;
      }

      updatedPartner = await ReferralPartner.findOneAndUpdate(
        {
          _id: partner._id,
          tenantId: partner.tenantId,
          status: "active",
          walletBalanceInPaise: {
            $gte: amountInPaise,
          },
        },
        {
          $inc: {
            walletBalanceInPaise: -amountInPaise,
          },
          $set: {
            updatedBy: req.user?._id,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedPartner) {
        const error = new Error(
          "Withdrawal amount exceeds available wallet balance"
        );
        error.statusCode = 400;
        throw error;
      }

      const bankDetailsSnapshot = buildBankDetailsSnapshot(
        req.body?.bankDetailsSnapshot || req.body?.bankDetails
      );

      const created = await WithdrawalRequest.create(
        [
          {
            tenantId: partner.tenantId,
            referralPartnerId: partner._id,
            amountInPaise,
            status: "requested",
            payoutMethod,
            upiId: upiId || undefined,
            bankDetailsSnapshot,
            requestedAt: new Date(),
            adminNote: hasText(req.body?.adminNote)
              ? String(req.body.adminNote).trim()
              : "Manual admin withdrawal request",
            createdBy: req.user?._id,
            updatedBy: req.user?._id,
          },
        ],
        {
          session,
        }
      );

      savedWithdrawal = created[0];
    });

    return res.status(201).json({
      success: true,
      message: "Withdrawal request created successfully",
      data: buildWithdrawalResponse(savedWithdrawal, updatedPartner),
    });
  } catch (error) {
    logRuntimeError("Create partner withdrawal request error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to create withdrawal request",
    });
  } finally {
    await session.endSession();
  }
};



const referralSettingsIntegerFields = {
  minimumWithdrawalAmountInPaise: {
    label: "Minimum withdrawal amount",
    min: 0,
  },
  rewardLockDays: {
    label: "Reward lock days",
    min: 0,
    max: 365,
  },
  refundSafetyDays: {
    label: "Refund safety days",
    min: 0,
    max: 365,
  },
  maxWithdrawalAmountPerMonthInPaise: {
    label: "Maximum monthly withdrawal amount",
    min: 0,
  },
};

const referralSettingsBooleanFields = [
  "kycRequired",
  "upiRequired",
  "bankRequired",
  "allowStudentPromoterWithdrawal",
  "manualApprovalRequired",
  "isReferralEnabled",
];

const getReferralSettingsTenantId = (req) => {
  const candidate =
    req.user?.role === "super_admin"
      ? req.query?.tenantId || req.body?.tenantId || req.user?.tenantId
      : req.user?.tenantId;

  return hasText(candidate) ? String(candidate).trim() : "";
};

const parseReferralSettingsInteger = (value, rule) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    const error = new Error(rule.label + " is required when provided");
    error.statusCode = 400;
    throw error;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || !Number.isInteger(numberValue)) {
    const error = new Error(rule.label + " must be a whole number");
    error.statusCode = 400;
    throw error;
  }

  if (numberValue < rule.min) {
    const error = new Error(rule.label + " cannot be less than " + rule.min);
    error.statusCode = 400;
    throw error;
  }

  if (rule.max !== undefined && numberValue > rule.max) {
    const error = new Error(rule.label + " cannot be greater than " + rule.max);
    error.statusCode = 400;
    throw error;
  }

  return numberValue;
};

const parseReferralSettingsBoolean = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  const error = new Error(fieldName + " must be true or false");
  error.statusCode = 400;
  throw error;
};

const buildReferralSettingsResponse = (settings) => {
  const plain =
    settings && typeof settings.toObject === "function"
      ? settings.toObject()
      : settings || {};

  return {
    _id: plain._id || null,
    tenantId: plain.tenantId,
    minimumWithdrawalAmountInPaise: plain.minimumWithdrawalAmountInPaise ?? 50000,
    minimumWithdrawalAmountInRupees: Number(
      ((plain.minimumWithdrawalAmountInPaise ?? 50000) / 100).toFixed(2)
    ),
    rewardLockDays: plain.rewardLockDays ?? 7,
    refundSafetyDays: plain.refundSafetyDays ?? 7,
    kycRequired: plain.kycRequired ?? false,
    upiRequired: plain.upiRequired ?? true,
    bankRequired: plain.bankRequired ?? false,
    maxWithdrawalAmountPerMonthInPaise:
      plain.maxWithdrawalAmountPerMonthInPaise ?? 0,
    maxWithdrawalAmountPerMonthInRupees: Number(
      ((plain.maxWithdrawalAmountPerMonthInPaise ?? 0) / 100).toFixed(2)
    ),
    allowStudentPromoterWithdrawal:
      plain.allowStudentPromoterWithdrawal ?? false,
    manualApprovalRequired: plain.manualApprovalRequired ?? true,
    isReferralEnabled: plain.isReferralEnabled ?? false,
    updatedBy: plain.updatedBy,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

const getReferralSettings = async (req, res) => {
  try {
    const tenantId = getReferralSettingsTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "tenantId is required for referral settings",
      });
    }

    const settings =
      (await ReferralSettings.findOne({ tenantId }).lean()) ||
      new ReferralSettings({ tenantId });

    return res.status(200).json({
      success: true,
      data: buildReferralSettingsResponse(settings),
    });
  } catch (error) {
    logRuntimeError("Get referral settings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral settings",
    });
  }
};

const updateReferralSettings = async (req, res) => {
  try {
    const tenantId = getReferralSettingsTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "tenantId is required for referral settings",
      });
    }

    const setData = {};

    Object.entries(referralSettingsIntegerFields).forEach(([fieldName, rule]) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, fieldName)) {
        setData[fieldName] = parseReferralSettingsInteger(req.body[fieldName], rule);
      }
    });

    referralSettingsBooleanFields.forEach((fieldName) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, fieldName)) {
        setData[fieldName] = parseReferralSettingsBoolean(
          req.body[fieldName],
          fieldName
        );
      }
    });

    setData.updatedBy = req.user?._id;

    const settings = await ReferralSettings.findOneAndUpdate(
      {
        tenantId,
      },
      {
        $set: setData,
        $setOnInsert: {
          tenantId,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Referral settings updated successfully",
      data: buildReferralSettingsResponse(settings),
    });
  } catch (error) {
    logRuntimeError("Update referral settings error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to update referral settings",
    });
  }
};


const withdrawalLedgerStatuses = [
  "requested",
  "approved",
  "rejected",
  "paid",
  "cancelled",
];

const buildWithdrawalTenantFilter = (req) => {
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

const buildWithdrawalSummary = (summaryRows) => {
  const summary = {
    total: {
      count: 0,
      amountInPaise: 0,
    },
    requested: {
      count: 0,
      amountInPaise: 0,
    },
    approved: {
      count: 0,
      amountInPaise: 0,
    },
    rejected: {
      count: 0,
      amountInPaise: 0,
    },
    paid: {
      count: 0,
      amountInPaise: 0,
    },
    cancelled: {
      count: 0,
      amountInPaise: 0,
    },
  };

  summaryRows.forEach((row) => {
    const status = row._id;

    if (!summary[status]) {
      return;
    }

    const count = row.count || 0;
    const amountInPaise = row.amountInPaise || 0;

    summary[status].count = count;
    summary[status].amountInPaise = amountInPaise;
    summary.total.count += count;
    summary.total.amountInPaise += amountInPaise;
  });

  return summary;
};

const buildWithdrawalLedgerPartnerPayload = (partner) => {
  if (!partner) {
    return null;
  }

  return {
    _id: partner._id,
    tenantId: partner.tenantId,
    name: partner.name,
    mobile: partner.mobile,
    email: partner.email,
    promoterType: partner.promoterType,
    code: partner.code,
    status: partner.status,
    walletBalanceInPaise: partner.walletBalanceInPaise,
    totalEarnedInPaise: partner.totalEarnedInPaise,
    totalWithdrawnInPaise: partner.totalWithdrawnInPaise,
  };
};

const getReferralWithdrawals = async (req, res) => {
  try {
    const page = Math.max(t45hToInteger(req.query.page, 1), 1);
    const limit = Math.min(Math.max(t45hToInteger(req.query.limit, 50), 1), 100);
    const skip = (page - 1) * limit;

    const filter = buildWithdrawalTenantFilter(req);

    if (req.query.status) {
      const status = String(req.query.status).trim();

      if (!withdrawalLedgerStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid withdrawal status",
        });
      }

      filter.status = status;
    }

    if (req.query.referralPartnerId) {
      if (!isValidObjectId(req.query.referralPartnerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid referralPartnerId",
        });
      }

      filter.referralPartnerId = new mongoose.Types.ObjectId(
        req.query.referralPartnerId
      );
    }

    if (req.query.payoutMethod) {
      const payoutMethod = normalizePayoutMethod(req.query.payoutMethod);

      if (!payoutMethod) {
        return res.status(400).json({
          success: false,
          message: "Invalid payout method",
        });
      }

      filter.payoutMethod = payoutMethod;
    }

    const [total, withdrawals, summaryRows] = await Promise.all([
      WithdrawalRequest.countDocuments(filter),
      WithdrawalRequest.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),
      WithdrawalRequest.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
            amountInPaise: {
              $sum: "$amountInPaise",
            },
          },
        },
      ]),
    ]);

    const partnerIds = [
      ...new Set(
        withdrawals
          .map((withdrawal) => String(withdrawal.referralPartnerId || ""))
          .filter(Boolean)
      ),
    ];

    const partners =
      partnerIds.length > 0
        ? await ReferralPartner.find({
            _id: {
              $in: partnerIds,
            },
          })
            .select(
              "tenantId name mobile email promoterType code status walletBalanceInPaise totalEarnedInPaise totalWithdrawnInPaise"
            )
            .lean()
        : [];

    const partnerById = new Map(
      partners.map((partner) => [String(partner._id), partner])
    );

    const data = withdrawals.map((withdrawal) => {
      const partner = partnerById.get(String(withdrawal.referralPartnerId));

      return {
        _id: withdrawal._id,
        tenantId: withdrawal.tenantId,
        referralPartnerId: withdrawal.referralPartnerId,
        referralPartner: buildWithdrawalLedgerPartnerPayload(partner),
        amountInPaise: withdrawal.amountInPaise,
        amountInRupees: Number(((withdrawal.amountInPaise || 0) / 100).toFixed(2)),
        status: withdrawal.status,
        payoutMethod: withdrawal.payoutMethod,
        upiId: withdrawal.upiId,
        bankDetailsSnapshot: withdrawal.bankDetailsSnapshot,
        requestedAt: withdrawal.requestedAt,
        approvedAt: withdrawal.approvedAt,
        rejectedAt: withdrawal.rejectedAt,
        paidAt: withdrawal.paidAt,
        cancelledAt: withdrawal.cancelledAt,
        adminNote: withdrawal.adminNote,
        createdAt: withdrawal.createdAt,
        updatedAt: withdrawal.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: buildWithdrawalSummary(summaryRows),
      data,
    });
  } catch (error) {
    logRuntimeError("Get referral withdrawals error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral withdrawals",
    });
  }
};


const buildWithdrawalMutationFilter = (req) => {
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

const createWithdrawalHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getWithdrawalAdminNote = (req) => {
  return hasText(req.body?.adminNote) ? req.body.adminNote.trim() : "";
};

const findWithdrawalForMutationError = async (req, session) => {
  return WithdrawalRequest.findOne(buildWithdrawalMutationFilter(req)).session(session);
};

const approveWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal request id",
      });
    }

    let updatedWithdrawal = null;
    let partner = null;

    await session.withTransaction(async () => {
      const now = new Date();
      const adminNote = getWithdrawalAdminNote(req);
      const setData = {
        status: "approved",
        approvedAt: now,
        updatedBy: req.user?._id,
      };

      if (adminNote) {
        setData.adminNote = adminNote;
      }

      updatedWithdrawal = await WithdrawalRequest.findOneAndUpdate(
        {
          ...buildWithdrawalMutationFilter(req),
          status: "requested",
        },
        {
          $set: setData,
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedWithdrawal) {
        const existingWithdrawal = await findWithdrawalForMutationError(req, session);

        if (!existingWithdrawal) {
          throw createWithdrawalHttpError(
            "Withdrawal request not found or access denied",
            404
          );
        }

        throw createWithdrawalHttpError(
          "Only requested withdrawals can be approved",
          409
        );
      }

      partner = await ReferralPartner.findOne({
        _id: updatedWithdrawal.referralPartnerId,
        tenantId: updatedWithdrawal.tenantId,
      }).session(session);

      if (!partner) {
        throw createWithdrawalHttpError("Referral partner not found", 404);
      }
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal request approved successfully",
      data: buildWithdrawalResponse(updatedWithdrawal, partner),
    });
  } catch (error) {
    logRuntimeError("Approve withdrawal request error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to approve withdrawal request",
    });
  } finally {
    await session.endSession();
  }
};

const rejectWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal request id",
      });
    }

    const adminNote = getWithdrawalAdminNote(req);

    if (!adminNote) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    let updatedWithdrawal = null;
    let partner = null;

    await session.withTransaction(async () => {
      const now = new Date();

      updatedWithdrawal = await WithdrawalRequest.findOneAndUpdate(
        {
          ...buildWithdrawalMutationFilter(req),
          status: {
            $in: ["requested", "approved"],
          },
        },
        {
          $set: {
            status: "rejected",
            rejectedAt: now,
            adminNote,
            updatedBy: req.user?._id,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedWithdrawal) {
        const existingWithdrawal = await findWithdrawalForMutationError(req, session);

        if (!existingWithdrawal) {
          throw createWithdrawalHttpError(
            "Withdrawal request not found or access denied",
            404
          );
        }

        throw createWithdrawalHttpError(
          "Only requested or approved withdrawals can be rejected",
          409
        );
      }

      partner = await ReferralPartner.findOneAndUpdate(
        {
          _id: updatedWithdrawal.referralPartnerId,
          tenantId: updatedWithdrawal.tenantId,
        },
        {
          $inc: {
            walletBalanceInPaise: updatedWithdrawal.amountInPaise,
          },
          $set: {
            updatedBy: req.user?._id,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!partner) {
        throw createWithdrawalHttpError("Referral partner not found", 404);
      }
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal request rejected and wallet refunded successfully",
      data: buildWithdrawalResponse(updatedWithdrawal, partner),
    });
  } catch (error) {
    logRuntimeError("Reject withdrawal request error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to reject withdrawal request",
    });
  } finally {
    await session.endSession();
  }
};

const markWithdrawalPaid = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal request id",
      });
    }

    let updatedWithdrawal = null;
    let partner = null;

    await session.withTransaction(async () => {
      const now = new Date();
      const adminNote = getWithdrawalAdminNote(req);
      const setData = {
        status: "paid",
        paidAt: now,
        updatedBy: req.user?._id,
      };

      if (adminNote) {
        setData.adminNote = adminNote;
      }

      updatedWithdrawal = await WithdrawalRequest.findOneAndUpdate(
        {
          ...buildWithdrawalMutationFilter(req),
          status: "approved",
        },
        {
          $set: setData,
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedWithdrawal) {
        const existingWithdrawal = await findWithdrawalForMutationError(req, session);

        if (!existingWithdrawal) {
          throw createWithdrawalHttpError(
            "Withdrawal request not found or access denied",
            404
          );
        }

        throw createWithdrawalHttpError(
          "Only approved withdrawals can be marked as paid",
          409
        );
      }

      partner = await ReferralPartner.findOneAndUpdate(
        {
          _id: updatedWithdrawal.referralPartnerId,
          tenantId: updatedWithdrawal.tenantId,
        },
        {
          $inc: {
            totalWithdrawnInPaise: updatedWithdrawal.amountInPaise,
          },
          $set: {
            updatedBy: req.user?._id,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!partner) {
        throw createWithdrawalHttpError("Referral partner not found", 404);
      }
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal request marked as paid successfully",
      data: buildWithdrawalResponse(updatedWithdrawal, partner),
    });
  } catch (error) {
    logRuntimeError("Mark withdrawal paid error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to mark withdrawal as paid",
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  adminRoles,
  getReferralSettings,
  updateReferralSettings,
  getReferralRewards,
  getReferralWithdrawals,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  markWithdrawalPaid,
  approveReferralReward,
  rejectReferralReward,
  createPartnerWithdrawalRequest,
  getReferralAttributions,
  getReferralPartners,
  getReferralPartnerById,
  createReferralPartner,
  updateReferralPartner,
  activateReferralPartner,
  suspendReferralPartner,
  rejectReferralPartner,
};

