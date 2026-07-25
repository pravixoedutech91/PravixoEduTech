const isHostedEnvironment = () =>
  process.env.NODE_ENV === "production" ||
  Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_DEPLOYMENT_ID
  );

const requirePublicRegistrationAvailable = (
  req,
  res,
  next
) => {
  if (isHostedEnvironment()) {
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
