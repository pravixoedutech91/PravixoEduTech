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

module.exports = {
  getTenantFilter,
  ensureTenantAccess,
};