const Tenant = require("../models/Tenant");

const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");

const DEFAULT_PUBLIC_REGISTRATION_TENANT_ID =
  "pravixoedutech";

const getConfiguredPublicRegistrationTenantId = () => {
  return String(
    process.env.PUBLIC_REGISTRATION_TENANT_ID ||
      DEFAULT_PUBLIC_REGISTRATION_TENANT_ID
  )
    .trim()
    .toLowerCase();
};

const resolvePublicRegistrationTenant = async (
  req,
  res,
  next
) => {
  try {
    const tenantId =
      getConfiguredPublicRegistrationTenantId();

    if (!tenantId) {
      return res.status(503).json({
        success: false,
        message: "Registration is currently unavailable",
      });
    }

    const tenant = await Tenant.findOne({
      slug: tenantId,
    });

    if (!tenant || !tenant.isActive) {
      return res.status(503).json({
        success: false,
        message: "Registration is currently unavailable",
      });
    }

    req.registrationTenantId = tenant.slug;
    req.registrationTenant = tenant;

    next();
  } catch (error) {
    logRuntimeError(
      "resolvePublicRegistrationTenant error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

module.exports = {
  DEFAULT_PUBLIC_REGISTRATION_TENANT_ID,
  getConfiguredPublicRegistrationTenantId,
  resolvePublicRegistrationTenant,
};