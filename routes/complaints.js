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

// GET all complaints
router.get("/", async (req, res) => {
  try {
    const complaints = await Complaint.find().populate('assignedTo', 'name email');
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

    // Validate inputs
    if (!employeeId) {
      return res.status(400).json({ 
        success: false, 
        message: "Employee ID is required" 
      });
    }

    // Find and update the complaint
    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { assignedTo: employeeId },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: "Complaint not found" 
      });
    }

    res.json({ 
      success: true, 
      message: "Complaint assigned successfully",
      complaint: complaint
    });

  } catch (err) {
    console.error("Assignment error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error assigning complaint: " + err.message 
    });
  }
});

module.exports = router;