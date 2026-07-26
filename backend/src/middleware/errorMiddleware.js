const {
  isHostedEnvironment,
  getInternalErrorMessage,
} = require("../utils/runtimeSecurity");

const logUnhandledRequestError = (error, req) => {
  if (!isHostedEnvironment()) {
    console.error(
      "Unhandled request error:",
      error
    );

    return;
  }

  const statusCode =
    Number(
      error &&
      (error.status || error.statusCode)
    );

  console.error(
    "Unhandled request error:",
    {
      method:
        req &&
        typeof req.method === "string"
          ? req.method
          : undefined,
      statusCode:
        Number.isInteger(statusCode)
          ? statusCode
          : 500,
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
    }
  );
};
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

const errorHandler = (
  error,
  req,
  res,
  next
) => {
  logUnhandledRequestError(error, req);

  if (res.headersSent) {
    return next(error);
  }

  if (
    error &&
    error.type === "entity.parse.failed" &&
    error.status === 400
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });
  }

  const statusCode =
    Number(
      error &&
      (error.status || error.statusCode)
    );

  if (
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode < 500
  ) {
    return res.status(statusCode).json({
      success: false,
      message: "Request could not be processed",
    });
  }

  return res.status(500).json({
    success: false,
    message:
      getInternalErrorMessage(error),
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
