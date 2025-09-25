require("dotenv").config(); // Load .env file

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const pool = require("./db"); // MySQL connection

// Import routes (you will need to update them later)
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

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    console.log("📦 Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Serve profile images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
});
