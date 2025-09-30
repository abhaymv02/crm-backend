const express = require("express");
const router = express.Router();
const pool = require("../db"); // MySQL connection
const { sendComplaintConfirmation } = require("../services/emailService");

// ---------------------- POST new complaint ----------------------
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      contact,
      company,
      category,
      complaint
    } = req.body;

    const reference = `CMP-${Date.now()}`;

    // Insert complaint into MySQL
    const [result] = await pool.query(
      `INSERT INTO tasks_complaint (name, email, contact, company, category, complaint, reference)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, contact, company, category, complaint, reference]
    );

    const complaintId = result.insertId;

    // Send confirmation email
    const emailResult = await sendComplaintConfirmation({
      email,
      name,
      contact,
      company,
      category,
      complaint,
      reference,
    });

    if (emailResult.success) {
      console.log(`📧 Confirmation email sent to ${email} Ref: ${reference}`);
    } else {
      console.error(`❌ Failed to send confirmation email: ${emailResult.message}`);
    }

    res.json({
      success: true,
      message: "Complaint submitted successfully",
      complaintId,
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

    let query = `
      SELECT c.*, e.name AS assigned_name, e.email AS assigned_email
      FROM tasks_complaint c
      LEFT JOIN accounts_employeeprofile e ON c.assigned_to = e.id
      WHERE 1=1
    `;
    const params = [];

    if (assignedTo) {
      query += " AND c.assigned_to = ?";
      params.push(assignedTo);
    }
    if (status) {
      query += " AND c.status = ?";
      params.push(status.toLowerCase());
    }

    const [complaints] = await pool.query(query, params);

    let filtered = complaints;

    if (assignedEmail) {
      filtered = complaints.filter(
        (c) => c.assigned_email?.toLowerCase() === assignedEmail.toLowerCase()
      );
    }

    res.json({ success: true, data: filtered });
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

    const [result] = await pool.query(
      "UPDATE tasks_complaint SET assigned_to = ? WHERE id = ?",
      [employeeId, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    const [updatedComplaint] = await pool.query(
      `
      SELECT c.*, e.name AS assigned_name, e.email AS assigned_email
      FROM tasks_complaint c
      LEFT JOIN accounts_employeeprofile e ON c.assigned_to = e.id
      WHERE c.id = ?
      `,
      [id]
    );

    res.json({
      success: true,
      message: "Complaint assigned successfully",
      complaint: updatedComplaint[0],
    });
  } catch (err) {
    console.error("Assignment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------- Update complaint status ----------------------
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const validStatuses = ["pending", "in-progress", "resolved"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const [result] = await pool.query(
      "UPDATE tasks_complaint SET status = ? WHERE id = ?",
      [status.toLowerCase(), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    const [updatedComplaint] = await pool.query(
      `
      SELECT c.*, e.name AS assigned_name, e.email AS assigned_email
      FROM tasks_complaint c
      LEFT JOIN accounts_employeeprofile e ON c.assigned_to = e.id
      WHERE c.id = ?
      `,
      [id]
    );

    res.json({
      success: true,
      message: "Complaint status updated successfully",
      complaint: updatedComplaint[0],
    });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
