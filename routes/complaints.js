const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint");

// POST new complaint
router.post("/", async (req, res) => {
  try {
    const complaint = new Complaint(req.body);
    await complaint.save();
    res.json({ success: true, message: "Complaint submitted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET complaints (all, by assignedTo ID, or by assignedEmail)
router.get("/", async (req, res) => {
  try {
    const { assignedTo, assignedEmail } = req.query;
    let filter = {};

    if (assignedTo) {
      // filter by employee ObjectId (still supported)
      filter.assignedTo = assignedTo;
    }

    let complaints = await Complaint.find(filter).populate("assignedTo", "name email");

    // If email is provided, filter after population
    if (assignedEmail) {
      complaints = complaints.filter(
        (c) => c.assignedTo?.email?.toLowerCase() === assignedEmail.toLowerCase()
      );
    }

    res.json(complaints);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT assign complaint to employee
router.put("/:id/assign", async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { assignedTo: employeeId },
      { new: true }
    ).populate("assignedTo", "name email");

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    res.json({
      success: true,
      message: "Complaint assigned successfully",
      complaint,
    });
  } catch (err) {
    console.error("Assignment error:", err);
    res.status(500).json({
      success: false,
      message: "Error assigning complaint: " + err.message,
    });
  }
});

module.exports = router;
