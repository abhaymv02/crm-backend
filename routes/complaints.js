const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint");

// ------------------- Helper to simulate auth -------------------
// If you want to later add JWT auth, you can replace this
const mockAuthMiddleware = (req, res, next) => {
  // Simulate a logged-in user
  req.user = {
    id: "mockUserId123", // Replace with real user ID from your frontend later
    role: "employee",    // or "admin"
  };
  next();
};

// POST new complaint
router.post("/", mockAuthMiddleware, async (req, res) => {
  try {
    const { title, description, priority, status } = req.body;
    if (!title || !priority) {
      return res.status(400).json({ success: false, message: "Title and priority are required" });
    }

    const complaint = new Complaint({
      ...req.body,
      createdBy: req.user.id, // attach user ID from simulated auth
    });

    await complaint.save();
    res.json({ success: true, message: "Complaint submitted successfully", data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all complaints for a specific user
router.get("/user/:userId", mockAuthMiddleware, async (req, res) => {
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

// GET all complaints (admin simulation)
router.get("/", mockAuthMiddleware, async (req, res) => {
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
