const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorMiddleware");
const {
  isHostedEnvironment: isHostedRuntimeEnvironment,
} = require("./utils/runtimeSecurity");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const categoryRoutes = require("./routes/categoryRoutes");
const contentRoutes = require("./routes/contentRoutes");
const tenantRoutes = require("./routes/tenantRoutes");
const authRoutes = require("./routes/authRoutes");
const examPatternRoutes = require("./routes/examPatternRoutes");
const questionRoutes = require("./routes/questionRoutes");
const mockTestRoutes = require("./routes/mockTestRoutes");
const questionGroupRoutes = require("./routes/questionGroupRoutes");
const studentMockTestRoutes = require("./routes/studentMockTestRoutes");
const paymentProductRoutes = require("./routes/paymentProductRoutes");
const sitePromotionRoutes = require("./routes/sitePromotionRoutes");
const referralPartnerRoutes = require("./routes/referralPartnerRoutes");
const razorpayWebhookRoutes = require("./routes/razorpayWebhookRoutes");
dotenv.config();

const normalizeConfiguredOrigin = (value) => {
  const origin = value.trim();

  if (!origin) {
    return "";
  }

  if (origin === "*") {
    throw new Error(
      "Wildcard CORS origins are not permitted"
    );
  }

  let parsedOrigin;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error(
      `Invalid configured frontend origin: ${origin}`
    );
  }

  if (
    parsedOrigin.protocol !== "http:" &&
    parsedOrigin.protocol !== "https:"
  ) {
    throw new Error(
      `Unsupported frontend origin protocol: ${origin}`
    );
  }

  return parsedOrigin.origin;
};

const isHostedEnvironment =
  process.env.NODE_ENV === "production" ||
  Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_DEPLOYMENT_ID
  );

const configuredOrigins = [
  ...(process.env.ALLOWED_ORIGINS || "").split(","),
  process.env.FRONTEND_URL || "",
]
  .map(normalizeConfiguredOrigin)
  .filter(Boolean);

if (
  isHostedEnvironment &&
  configuredOrigins.length === 0
) {
  throw new Error(
    "Missing ALLOWED_ORIGINS or FRONTEND_URL in hosted environment"
  );
}

const allowedOrigins = new Set(
  configuredOrigins.length > 0
    ? configuredOrigins
    : ["http://localhost:3000"]
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    return callback(
      null,
      allowedOrigins.has(origin)
    );
  },
  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
  maxAge: 600,
};

connectDB();

const app = express();

const helmetOptions = isHostedRuntimeEnvironment()
  ? {
      contentSecurityPolicy: false,
    }
  : {
      contentSecurityPolicy: false,
      strictTransportSecurity: false,
    };

app.disable("x-powered-by");
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));
app.use(
  "/api/webhooks/razorpay",
  express.raw({
    type: "application/json",
    limit: "256kb",
  }),
  razorpayWebhookRoutes
);
app.use(express.json());
app.use("/api/categories", categoryRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/exam-patterns", examPatternRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/mock-tests", mockTestRoutes);
app.use("/api/question-groups", questionGroupRoutes);
app.use("/api/student", studentMockTestRoutes);
app.use("/api/payment-products", paymentProductRoutes);
app.use("/api/promotions", sitePromotionRoutes);
app.use("/api/referral-partners", referralPartnerRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PravixoEduTech Backend Running 🚀",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
