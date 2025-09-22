require("dotenv").config(); // Load .env file

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

// Import routes
const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");
const departmentRoutes = require("./routes/departments");
const taskRoutes = require("./routes/tasks");
const complaintRoutes = require("./routes/complaints");
const emailRoutes = require("./routes/emailRoutes");

const app = express();

// ---------------------- MIDDLEWARE ----------------------
app.use(bodyParser.json());
app.use(cors());

// Enhanced request logger for debugging
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    console.log("📦 Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Serve profile images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------- CONNECT TO MONGODB ----------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------------------- ROUTES ----------------------
app.get("/", (req, res) => {
  res.send("🚀 CRM Backend is running!");
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/email", emailRoutes);

// ---------------------- ERROR HANDLING ----------------------
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// ---------------------- START SERVER ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Available endpoints:`);
  console.log(`  GET /`);
  console.log(`  POST /api/email/send-email`);
  console.log(`  POST /api/email/send-confirmation`);
});
