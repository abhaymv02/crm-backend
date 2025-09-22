const express = require('express');
const { sendEmail } = require('../services/emailService');
const router = express.Router();

// POST /api/send-email - Send confirmation email
router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    // Validation
    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, subject, and body are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address provided',
      });
    }

    // Send email
    const result = await sendEmail({ to, subject, body });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Confirmation email sent successfully',
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email: ' + result.message,
      });
    }
  } catch (error) {
    console.error('Email route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending email',
    });
  }
});

module.exports = router;