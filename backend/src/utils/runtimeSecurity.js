const isHostedEnvironment = () =>
  process.env.NODE_ENV === "production" ||
  Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_DEPLOYMENT_ID
  );

const getInternalErrorMessage = (error) => {
  if (isHostedEnvironment()) {
    return "Internal server error";
  }

  if (
    error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Internal server error";
};

module.exports = {
  isHostedEnvironment,
  getInternalErrorMessage,
};
