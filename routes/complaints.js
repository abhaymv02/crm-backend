
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
    const { assignedTo, assignedEmail, status } = req.query;
    let filter = {};

    if (assignedTo) {
      // filter by employee ObjectId (still supported)
      filter.assignedTo = assignedTo;
    }
    if (status) {
      // filter by status
      filter.status = status;
    }

    let complaints = await Complaint.find(filter).populate("assignedTo", "name email");

    // If email is provided, filter after population
    if (assignedEmail) {
      complaints = complaints.filter(
        (c) => c.assignedTo?.email?.toLowerCase() === assignedEmail.toLowerCase()
      );
    }

    res.json({ success: true, data: complaints });
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

// PATCH update complaint status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Validate status (optional: restrict to specific values)
    const validStatuses = ["pending", "in-progress", "resolved"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { status: status.toLowerCase() },
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
      message: "Complaint status updated successfully",
      complaint,
    });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating complaint status: " + err.message,
    });
  }
});

module.exports = router;
