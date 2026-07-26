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


const logRuntimeError = (context, error) => {
  if (!isHostedEnvironment()) {
    console.error(context, error);
    return;
  }

  const statusCode = Number(
    error &&
      (error.status || error.statusCode)
  );

  console.error(context, {
    name:
      error &&
      typeof error.name === "string"
        ? error.name
        : "Error",
    type:
      error &&
      typeof error.type === "string"
        ? error.type
        : undefined,
    statusCode:
      Number.isInteger(statusCode)
        ? statusCode
        : undefined,
  });
};

module.exports = {
  isHostedEnvironment,
  getInternalErrorMessage,
  logRuntimeError,
};
