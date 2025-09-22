const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint");
const { sendComplaintConfirmation } = require("../services/emailService");

// ---------------------- POST new complaint ----------------------
router.post("/", async (req, res) => {
  try {
    const complaint = new Complaint(req.body);
    await complaint.save();

    // Generate reference number if not provided
    const reference = `CMP-${Date.now()}`;

    // Send confirmation email asynchronously
    const emailResult = await sendComplaintConfirmation({
      email: complaint.email,
      name: complaint.name,
      contact: complaint.contact,
      company: complaint.company,
      category: complaint.category,
      complaint: complaint.complaint,
      reference,
    });

    if (emailResult.success) {
      console.log(`📧 Confirmation email sent to ${complaint.email} Ref: ${reference}`);
    } else {
      console.error(`❌ Failed to send confirmation email: ${emailResult.message}`);
    }

    res.json({
      success: true,
      message: "Complaint submitted successfully",
      complaintId: complaint._id,
      emailSent: emailResult.success,
      reference,
    });
  } catch (err) {
    console.error("Complaint submission error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------- GET complaints ----------------------
router.get("/", async (req, res) => {
  try {
    const { assignedTo, assignedEmail, status } = req.query;
    let filter = {};

    if (assignedTo) filter.assignedTo = assignedTo;
    if (status) filter.status = status.toLowerCase();

    let complaints = await Complaint.find(filter).populate("assignedTo", "name email");

    if (assignedEmail) {
      complaints = complaints.filter(
        (c) => c.assignedTo?.email?.toLowerCase() === assignedEmail.toLowerCase()
      );
    }

    res.json({ success: true, data: complaints });
  } catch (err) {
    console.error("Error fetching complaints:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------- Assign complaint ----------------------
router.put("/:id/assign", async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { assignedTo: employeeId },
      { new: true }
    ).populate("assignedTo", "name email");

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    res.json({ success: true, message: "Complaint assigned successfully", complaint });
  } catch (err) {
    console.error("Assignment error:", err);
    res.status(500).json({ success: false, message: "Error assigning complaint: " + err.message });
  }
});

// ---------------------- Update complaint status ----------------------
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ success: false, message: "Status is required" });

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
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    res.json({ success: true, message: "Complaint status updated successfully", complaint });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ success: false, message: "Error updating complaint status: " + err.message });
  }
});

module.exports = router;
