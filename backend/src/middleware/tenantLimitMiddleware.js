const {
  getInternalErrorMessage,
  logRuntimeError,
} = require("../utils/runtimeSecurity");
const User = require("../models/User");

const checkStudentLimit = async (req, res, next) => {
  try {
    const tenantId = String(
      req.registrationTenantId || ""
    ).trim();

    const tenant = req.registrationTenant;

    if (
      !tenantId ||
      !tenant ||
      String(tenant.slug) !== tenantId
    ) {
      return res.status(503).json({
        success: false,
        message: "Registration is currently unavailable",
      });
    }

    const maxStudents =
      tenant.limits.maxStudents;

    // 0 = unlimited
    if (maxStudents === 0) {
      return next();
    }

    const currentStudents =
      await User.countDocuments({
        tenantId,
        role: "student",
      });

    if (currentStudents >= maxStudents) {
      return res.status(403).json({
        success: false,
        message:
          "Student limit reached for this tenant",
      });
    }

    next();
  } catch (error) {
    logRuntimeError("tenantLimitMiddleware error:", error);

    res.status(500).json({
      success: false,
      message: getInternalErrorMessage(error),
    });
  }
};

module.exports = {
  checkStudentLimit,
};