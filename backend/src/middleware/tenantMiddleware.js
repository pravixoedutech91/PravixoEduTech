const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");

const Tenant = require("../models/Tenant");

// Tenant Isolation Helper

const getTenantFilter = (req) => {
  if (!req.user) {
    return {};
  }

  if (req.user.role === "super_admin") {
    if (req.params.tenantId) {
      return { tenantId: req.params.tenantId };
    }

    if (req.query.tenantId) {
      return { tenantId: req.query.tenantId };
    }

    return {};
  }

  return {
    tenantId: req.user.tenantId,
  };
};

const ensureTenantAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }

  if (req.user.role === "super_admin") {
    return next();
  }

  const requestedTenantId =
  req.params.tenantId ||
  req.body?.tenantId ||
  req.query?.tenantId;
  if (
    requestedTenantId &&
    requestedTenantId !== req.user.tenantId
  ) {
    return res.status(403).json({
      success: false,
      message: "Tenant access denied",
    });
  }

  next();
};

const checkFeatureAccess = (featureName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authorized",
        });
      }

      if (req.user.role === "super_admin") {
        return next();
      }

      const tenant = await Tenant.findOne({
        slug: req.user.tenantId,
      });

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: "Tenant not found",
        });
      }

      if (!tenant.isActive) {
        return res.status(403).json({
          success: false,
          message: "Tenant is inactive",
        });
      }

      if (!tenant.features[featureName]) {
        return res.status(403).json({
          success: false,
          message: `${featureName} feature is not enabled for this tenant`,
        });
      }

      req.tenant = tenant;

      next();
    } catch (error) {
      logRuntimeError("tenantMiddleware error:", error);

      res.status(500).json({
        success: false,
        message: getInternalErrorMessage(error),
      });
    }
  };
};

const checkContentFeatureAccess = async (req, res, next) => {
  try {
    const contentType = req.body?.type;

    const featureMap = {
      article: "articles",
      study_note: "articles",
      notification: "articles",
      current_affairs: "articles",
      vacancy: "articles",
      admit_card: "articles",
      result: "articles",
      syllabus: "articles",
      exam_page: "articles",
    };

    const featureName = featureMap[contentType];

    if (!featureName) {
      return res.status(400).json({
        success: false,
        message: "Invalid content type",
      });
    }

    return checkFeatureAccess(featureName)(req, res, next);
  } catch (error) {
    logRuntimeError("tenantMiddleware error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

module.exports = {
  getTenantFilter,
  ensureTenantAccess,
  checkFeatureAccess,
  checkContentFeatureAccess,
};
