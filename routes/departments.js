const express = require("express");
const router = express.Router();
const pool = require("../db"); // MySQL connection

// ---------------------- CREATE Department ----------------------
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Department name is required" });
    }

    // Check if department already exists
    const [exists] = await pool.query(
      "SELECT id FROM departments WHERE name = ? LIMIT 1",
      [name]
    );

    if (exists.length > 0) {
      return res.status(400).json({ success: false, message: "Department already exists" });
    }

    // Insert new department
    await pool.query(
      "INSERT INTO departments (name) VALUES (?)",
      [name]
    );

    res.json({ success: true, message: "✅ Department added successfully" });
  } catch (err) {
    console.error("❌ Error adding department:", err.message);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// ---------------------- GET Departments ----------------------
router.get("/", async (req, res) => {
  try {
    const [departments] = await pool.query(
      "SELECT * FROM departments ORDER BY name ASC"
    );

    res.json({ success: true, data: departments });
  } catch (err) {
    console.error("❌ Error fetching departments:", err.message);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
