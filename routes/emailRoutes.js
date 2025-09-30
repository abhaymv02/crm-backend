const express = require("express");
const { sendEmail, sendComplaintConfirmation } = require("../services/emailService");
const router = express.Router();

// ---------------------- UTILITY ----------------------
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ---------------------- POST /send-email ----------------------
router.post("/send-email", async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    console.log("📩 /send-email request body:", req.body);

    // Validate required fields
    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: to, subject, and body are required",
      });
    }

    // Validate email
    if (!isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address provided",
      });
    }

    const result = await sendEmail({ to, subject, body });

    console.log("📩 /send-email result:", result);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Email sent successfully",
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `Failed to send email: ${result.message}`,
      });
    }
  } catch (error) {
    console.error("❌ /send-email error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while sending email",
    });
  }
});

// ---------------------- POST /send-confirmation ----------------------
router.post("/send-confirmation", async (req, res) => {
  try {
    const { to, name, contact, company, category, complaint, reference } = req.body;

    console.log("📩 /send-confirmation request body:", req.body);

    // Validate required fields
    if (!to || !name || !reference) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: to, name, and reference are required",
      });
    }

    // Validate email
    if (!isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address provided",
      });
    }

    const result = await sendComplaintConfirmation({
      email: to,
      name,
      contact: contact || "Not provided",
      company: company || "Not provided",
      category: category || "General",
      complaint: complaint || "No details provided",
      reference,
    });

    console.log("📩 /send-confirmation result:", result);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Confirmation email sent successfully",
        messageId: result.messageId,
        reference: result.reference,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `Failed to send confirmation email: ${result.message}`,
      });
    }
  } catch (error) {
    console.error("❌ /send-confirmation error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while sending confirmation email",
    });
  }
});

module.exports = router;