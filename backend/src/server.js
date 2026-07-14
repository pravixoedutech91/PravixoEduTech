const express = require("express");
const cors = require("cors");
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
dotenv.config();

connectDB();

const app = express();

app.use(cors());
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

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PravixoEduTech Backend Running 🚀",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});