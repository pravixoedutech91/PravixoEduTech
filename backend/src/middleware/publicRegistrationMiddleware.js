const {
  isHostedEnvironment,
} = require("../utils/runtimeSecurity");

const isPublicRegistrationEnabled = () =>
  process.env.PUBLIC_REGISTRATION_ENABLED === "true";

const requirePublicRegistrationAvailable = (
  req,
  res,
  next
) => {
  if (isHostedEnvironment() && !isPublicRegistrationEnabled()) {
    return res.status(503).json({
      success: false,
      message: "Registration is currently unavailable",
    });
  }

  next();
};

module.exports = {
  requirePublicRegistrationAvailable,
};
