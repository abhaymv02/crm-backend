const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint");
const authMiddleware = require("../middleware/auth"); // JWT auth middleware

// POST new complaint (authenticated)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, description, priority, status } = req.body;
    if (!title || !priority) {
      return res.status(400).json({ success: false, message: "Title and priority are required" });
    }

    const complaint = new Complaint({
      ...req.body,
      createdBy: req.user.id, // attach user ID from auth
    });

    await complaint.save();
    res.json({ success: true, message: "Complaint submitted successfully", data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all complaints for logged-in user
router.get("/user/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }

    const complaints = await Complaint.find({ createdBy: userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all complaints (admin only)
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access only" });
    }

    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json({ success: true, data: complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
