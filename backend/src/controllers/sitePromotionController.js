const mongoose = require("mongoose");

const SitePromotion = require("../models/SitePromotion");
const {
  getTenantFilter,
} = require("../middleware/tenantMiddleware");

const PUBLIC_TENANT_ID =
  process.env.PUBLIC_TENANT_ID || "pravixoedutech";

const ALLOWED_PLACEMENTS = [
  "home_hero",
  "exams_hero",
  "study_notes_hero",
  "current_affairs_hero",
  "jobs_hero",
  "mock_tests_hero",
];

const ALLOWED_STATUSES = [
  "draft",
  "active",
  "inactive",
];

const hasText = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const hasOwn = (object, key) => {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(
    String(value || "")
  );
};

const getWriteTenantId = (req) => {
  if (req.user?.role === "super_admin") {
    return (
      req.body?.tenantId ||
      req.user?.tenantId ||
      PUBLIC_TENANT_ID
    );
  }

  return req.user?.tenantId;
};

const normalizeInternalCtaUrl = (value) => {
  if (!hasText(value)) {
    return {
      error: "Promotion CTA URL is required",
    };
  }

  const url = value.trim();

  if (
    !/^\/(?!\/)/.test(url) ||
    /[\u0000-\u001f\\]/.test(url)
  ) {
    return {
      error:
        "Promotion CTA URL must be an internal path beginning with /",
    };
  }

  return {
    value: url,
  };
};

const normalizeImageUrl = (value) => {
  if (!hasText(value)) {
    return {
      value: "",
    };
  }

  const imageUrl = value.trim();

  try {
    const parsed = new URL(imageUrl);

    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password
    ) {
      return {
        error:
          "Promotion image URL must be a valid HTTPS URL",
      };
    }

    return {
      value: imageUrl,
    };
  } catch {
    return {
      error:
        "Promotion image URL must be a valid HTTPS URL",
    };
  }
};

const normalizeDate = (value, fieldLabel) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return {
      value: null,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      error: `${fieldLabel} must be a valid date`,
    };
  }

  return {
    value: date,
  };
};

const normalizePriority = (value) => {
  const priority = Number(value);

  if (
    !Number.isInteger(priority) ||
    priority < 0 ||
    priority > 1000
  ) {
    return {
      error:
        "Promotion priority must be an integer between 0 and 1000",
    };
  }

  return {
    value: priority,
  };
};

const validateDateOrder = (startAt, endAt) => {
  if (
    startAt &&
    endAt &&
    endAt.getTime() < startAt.getTime()
  ) {
    return {
      error:
        "Promotion endAt must be on or after startAt",
    };
  }

  return {};
};

const sendControllerError = (res, error) => {
  console.error(error);

  if (error?.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Promotion validation failed",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Unable to process promotion request",
  });
};

const buildCreateData = (req) => {
  const tenantId =
    String(getWriteTenantId(req) || "").trim();

  const placement =
    hasText(req.body?.placement)
      ? req.body.placement.trim()
      : "";

  const title =
    hasText(req.body?.title)
      ? req.body.title.trim()
      : "";

  const subtitle =
    hasText(req.body?.subtitle)
      ? req.body.subtitle.trim()
      : "";

  const badgeText =
    hasText(req.body?.badgeText)
      ? req.body.badgeText.trim()
      : "";

  const ctaLabel =
    hasText(req.body?.ctaLabel)
      ? req.body.ctaLabel.trim()
      : "";

  const status =
    hasText(req.body?.status)
      ? req.body.status.trim()
      : "draft";

  if (!hasText(tenantId)) {
    return {
      error: "Valid tenantId is required",
    };
  }

  if (!ALLOWED_PLACEMENTS.includes(placement)) {
    return {
      error: "Invalid promotion placement",
    };
  }

  if (!title) {
    return {
      error: "Promotion title is required",
    };
  }

  if (!ctaLabel) {
    return {
      error: "Promotion CTA label is required",
    };
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return {
      error: "Invalid promotion status",
    };
  }

  const ctaUrlResult =
    normalizeInternalCtaUrl(req.body?.ctaUrl);

  if (ctaUrlResult.error) {
    return {
      error: ctaUrlResult.error,
    };
  }

  const imageUrlResult =
    normalizeImageUrl(req.body?.imageUrl);

  if (imageUrlResult.error) {
    return {
      error: imageUrlResult.error,
    };
  }

  const priorityResult =
    normalizePriority(
      req.body?.priority === undefined
        ? 0
        : req.body.priority
    );

  if (priorityResult.error) {
    return {
      error: priorityResult.error,
    };
  }

  const startAtResult =
    normalizeDate(
      req.body?.startAt,
      "Promotion startAt"
    );

  if (startAtResult.error) {
    return {
      error: startAtResult.error,
    };
  }

  const endAtResult =
    normalizeDate(
      req.body?.endAt,
      "Promotion endAt"
    );

  if (endAtResult.error) {
    return {
      error: endAtResult.error,
    };
  }

  const dateOrderResult =
    validateDateOrder(
      startAtResult.value,
      endAtResult.value
    );

  if (dateOrderResult.error) {
    return {
      error: dateOrderResult.error,
    };
  }

  return {
    data: {
      tenantId,
      placement,
      title,
      subtitle,
      badgeText,
      imageUrl: imageUrlResult.value,
      ctaLabel,
      ctaUrl: ctaUrlResult.value,
      status,
      priority: priorityResult.value,
      startAt: startAtResult.value,
      endAt: endAtResult.value,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    },
  };
};

const buildUpdateData = (req, promotion) => {
  const data = {};

  if (hasOwn(req.body, "placement")) {
    const placement =
      hasText(req.body?.placement)
        ? req.body.placement.trim()
        : "";

    if (!ALLOWED_PLACEMENTS.includes(placement)) {
      return {
        error: "Invalid promotion placement",
      };
    }

    data.placement = placement;
  }

  if (hasOwn(req.body, "title")) {
    const title =
      hasText(req.body?.title)
        ? req.body.title.trim()
        : "";

    if (!title) {
      return {
        error: "Promotion title is required",
      };
    }

    data.title = title;
  }

  if (hasOwn(req.body, "subtitle")) {
    data.subtitle =
      hasText(req.body?.subtitle)
        ? req.body.subtitle.trim()
        : "";
  }

  if (hasOwn(req.body, "badgeText")) {
    data.badgeText =
      hasText(req.body?.badgeText)
        ? req.body.badgeText.trim()
        : "";
  }

  if (hasOwn(req.body, "imageUrl")) {
    const imageUrlResult =
      normalizeImageUrl(req.body?.imageUrl);

    if (imageUrlResult.error) {
      return {
        error: imageUrlResult.error,
      };
    }

    data.imageUrl = imageUrlResult.value;
  }

  if (hasOwn(req.body, "ctaLabel")) {
    const ctaLabel =
      hasText(req.body?.ctaLabel)
        ? req.body.ctaLabel.trim()
        : "";

    if (!ctaLabel) {
      return {
        error: "Promotion CTA label is required",
      };
    }

    data.ctaLabel = ctaLabel;
  }

  if (hasOwn(req.body, "ctaUrl")) {
    const ctaUrlResult =
      normalizeInternalCtaUrl(req.body?.ctaUrl);

    if (ctaUrlResult.error) {
      return {
        error: ctaUrlResult.error,
      };
    }

    data.ctaUrl = ctaUrlResult.value;
  }

  if (hasOwn(req.body, "status")) {
    const status =
      hasText(req.body?.status)
        ? req.body.status.trim()
        : "";

    if (!ALLOWED_STATUSES.includes(status)) {
      return {
        error: "Invalid promotion status",
      };
    }

    data.status = status;
  }

  if (hasOwn(req.body, "priority")) {
    const priorityResult =
      normalizePriority(req.body?.priority);

    if (priorityResult.error) {
      return {
        error: priorityResult.error,
      };
    }

    data.priority = priorityResult.value;
  }

  let nextStartAt = promotion.startAt || null;
  let nextEndAt = promotion.endAt || null;

  if (hasOwn(req.body, "startAt")) {
    const startAtResult =
      normalizeDate(
        req.body?.startAt,
        "Promotion startAt"
      );

    if (startAtResult.error) {
      return {
        error: startAtResult.error,
      };
    }

    data.startAt = startAtResult.value;
    nextStartAt = startAtResult.value;
  }

  if (hasOwn(req.body, "endAt")) {
    const endAtResult =
      normalizeDate(
        req.body?.endAt,
        "Promotion endAt"
      );

    if (endAtResult.error) {
      return {
        error: endAtResult.error,
      };
    }

    data.endAt = endAtResult.value;
    nextEndAt = endAtResult.value;
  }

  const dateOrderResult =
    validateDateOrder(
      nextStartAt,
      nextEndAt
    );

  if (dateOrderResult.error) {
    return {
      error: dateOrderResult.error,
    };
  }

  data.updatedBy = req.user?._id;

  return {
    data,
  };
};

const getActivePromotion = async (req, res) => {
  try {
    const placement =
      hasText(req.query?.placement)
        ? req.query.placement.trim()
        : "";

    if (!ALLOWED_PLACEMENTS.includes(placement)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promotion placement",
      });
    }

    const now = new Date();

    const promotion = await SitePromotion.findOne({
      tenantId: PUBLIC_TENANT_ID,
      placement,
      status: "active",
      $and: [
        {
          $or: [
            { startAt: null },
            { startAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { endAt: null },
            { endAt: { $gte: now } },
          ],
        },
      ],
    })
      .sort({
        priority: -1,
        updatedAt: -1,
      })
      .select(
        "placement title subtitle badgeText imageUrl " +
          "ctaLabel ctaUrl priority startAt endAt updatedAt"
      );

    return res.status(200).json({
      success: true,
      data: promotion || null,
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

const getAdminPromotions = async (req, res) => {
  try {
    const filter = {
      ...getTenantFilter(req),
    };

    if (req.query?.placement) {
      const placement =
        String(req.query.placement).trim();

      if (!ALLOWED_PLACEMENTS.includes(placement)) {
        return res.status(400).json({
          success: false,
          message: "Invalid promotion placement",
        });
      }

      filter.placement = placement;
    }

    if (req.query?.status) {
      const status =
        String(req.query.status).trim();

      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid promotion status",
        });
      }

      filter.status = status;
    }

    const promotions = await SitePromotion.find(filter)
      .sort({
        priority: -1,
        updatedAt: -1,
      })
      .limit(100);

    const total =
      await SitePromotion.countDocuments(filter);

    return res.status(200).json({
      success: true,
      total,
      data: promotions,
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

const getAdminPromotionById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promotion ID",
      });
    }

    const promotion = await SitePromotion.findOne({
      _id: req.params.id,
      ...getTenantFilter(req),
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message:
          "Promotion not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

const createPromotion = async (req, res) => {
  try {
    const result = buildCreateData(req);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    const promotion =
      await SitePromotion.create(result.data);

    return res.status(201).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

const updatePromotion = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promotion ID",
      });
    }

    const promotion = await SitePromotion.findOne({
      _id: req.params.id,
      ...getTenantFilter(req),
    });

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message:
          "Promotion not found or access denied",
      });
    }

    const result =
      buildUpdateData(req, promotion);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    Object.assign(
      promotion,
      result.data
    );

    await promotion.save();

    return res.status(200).json({
      success: true,
      data: promotion,
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

module.exports = {
  getActivePromotion,
  getAdminPromotions,
  getAdminPromotionById,
  createPromotion,
  updatePromotion,
};
