const express = require("express");
const router = express.Router();
const Department = require("../models/Department");

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Department name is required" });
    }

    const exists = await Department.findOne({ name });
    if (exists) {
      return res.status(400).json({ success: false, message: "Department already exists" });
    }

    const newDepartment = new Department({ name });
    await newDepartment.save();

    res.json({ success: true, message: "✅ Department added successfully" });
  } catch (err) {
    console.error("❌ Error adding department:", err.message);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
