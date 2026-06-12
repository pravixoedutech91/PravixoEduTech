const Tenant = require("../models/Tenant");
const User = require("../models/User");

const checkStudentLimit = async (req, res, next) => {
  try {
    const tenantId =
      req.body.tenantId || "pravixoedutech";

    const tenant = await Tenant.findOne({
      slug: tenantId,
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
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
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  checkStudentLimit,
};