const express = require('express');
const { sendEmail, sendComplaintConfirmation } = require('../services/emailService');
const router = express.Router();

// POST /api/email/send-email - Generic email sending
router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, subject, and body are required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address provided',
      });
    }

    const result = await sendEmail({ to, subject, body });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
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

// POST /api/email/send-confirmation - Specific for complaint confirmations
router.post('/send-confirmation', async (req, res) => {
  try {
    const { to, name, contact, company, category, complaint, reference } = req.body;

    if (!to || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to and name are required',
      });
    }

    const result = await sendComplaintConfirmation({
      to,
      name,
      contact,
      company,
      category,
      complaint,
      reference,
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Confirmation email sent successfully',
        messageId: result.messageId,
        reference: result.reference,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send confirmation email: ' + result.message,
      });
    }
  } catch (error) {
    console.error('Confirmation email route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending confirmation email',
    });
  }
});

module.exports = router;