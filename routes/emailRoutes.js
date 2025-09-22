const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { sendEmail, sendComplaintConfirmation, testEmailConnection } = require('../services/emailService');

const router = express.Router();

// ==================== RATE LIMITING ====================

// General email rate limiting
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 email requests per windowMs
  message: {
    success: false,
    message: 'Too many email requests from this IP. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and tests from localhost in development
    return process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1';
  }
});

// Stricter rate limiting for confirmation emails
const confirmationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 confirmation emails per windowMs
  message: {
    success: false,
    message: 'Too many confirmation email requests from this IP. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== VALIDATION MIDDLEWARE ====================

// Generic email validation
const validateGenericEmail = [
  body('to')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('subject')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject is required and must be less than 200 characters')
    .escape(), // Prevent XSS
  
  body('body')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Email body is required and must be less than 5000 characters'),
  
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high'])
    .withMessage('Priority must be low, normal, or high'),

  body('html')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('HTML content must be less than 10000 characters')
];

// Confirmation email validation
const validateConfirmationEmail = [
  body('to')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid recipient email address'),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .escape(),
  
  body('contact')
    .optional()
    .trim()
    .isLength({ min: 10, max: 15 })
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Contact number must be 10-15 digits and contain only numbers, spaces, hyphens, plus signs, and parentheses'),
  
  body('company')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Company name must be less than 200 characters')
    .escape(),
  
  body('category')
    .optional()
    .isIn(['CCTV', 'Home Automation', 'Motion Works', 'General'])
    .withMessage('Invalid category selected'),
  
  body('complaint')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Complaint description must be less than 2000 characters'),
  
  body('reference')
    .optional()
    .trim()
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage('Reference must contain only alphanumeric characters, hyphens, and underscores')
];

// Test email validation
const validateTestEmail = [
  body('to')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required for testing')
];

// ==================== HELPER FUNCTIONS ====================

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Log email activity
const logEmailActivity = (type, recipient, success, reference = null) => {
  const timestamp = new Date().toISOString();
  const status = success ? '✅' : '❌';
  const ref = reference ? ` [${reference}]` : '';
  console.log(`${status} [${timestamp}] ${type} email to ${recipient}${ref}`);
};

// ==================== ROUTES ====================

// POST /api/email/send-email - Generic email sending
router.post('/send-email', emailLimiter, validateGenericEmail, handleValidationErrors, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { to, subject, body, html, priority = 'normal' } = req.body;

    console.log(`📧 Processing generic email request to: ${to}`);
    console.log(`📋 Subject: ${subject}`);

    // Additional server-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      logEmailActivity('Generic', to, false);
      return res.status(400).json({
        success: false,
        message: 'Invalid email address provided',
        error: 'INVALID_EMAIL_FORMAT'
      });
    }

    const result = await sendEmail({
      to,
      subject,
      body,
      html,
      priority
    });

    const processingTime = Date.now() - startTime;
    logEmailActivity('Generic', to, result.success);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        data: {
          messageId: result.messageId,
          recipient: to,
          subject: subject,
          priority: priority,
          sentAt: new Date().toISOString(),
          processingTimeMs: processingTime
        }
      });
    } else {
      console.error('Generic email sending failed:', result.message);
      res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: result.message,
        code: result.error,
        processingTimeMs: processingTime
      });
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Generic email route error:', error);
    logEmailActivity('Generic', req.body.to, false);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending email',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
      processingTimeMs: processingTime
    });
  }
});

// POST /api/email/send-confirmation - Complaint confirmation emails
router.post('/send-confirmation', confirmationLimiter, validateConfirmationEmail, handleValidationErrors, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { to, name, contact, company, category, complaint, reference } = req.body;

    console.log(`📧 Processing confirmation email request to: ${to}`);
    console.log(`👤 Customer: ${name} from ${company || 'N/A'}`);
    console.log(`📋 Category: ${category || 'General'}, Reference: ${reference || 'auto-generated'}`);

    // Additional server-side validation
    if (!to || !name) {
      logEmailActivity('Confirmation', to, false, reference);
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to and name are required',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await sendComplaintConfirmation({
      name,
      email: to, // Map 'to' to 'email' for the service function
      contact,
      company,
      category,
      complaint,
      reference
    });

    const processingTime = Date.now() - startTime;
    logEmailActivity('Confirmation', to, result.success, result.reference);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Confirmation email sent successfully',
        data: {
          messageId: result.messageId,
          reference: result.reference,
          recipient: to,
          customerName: name,
          category: category || 'General',
          sentAt: new Date().toISOString(),
          processingTimeMs: processingTime
        }
      });
    } else {
      console.error('Confirmation email sending failed:', result.message);
      res.status(500).json({
        success: false,
        message: 'Failed to send confirmation email',
        error: result.message,
        code: result.error,
        processingTimeMs: processingTime
      });
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Confirmation email route error:', error);
    logEmailActivity('Confirmation', req.body.to, false, req.body.reference);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending confirmation email',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
      processingTimeMs: processingTime
    });
  }
});

// ==================== UTILITY ROUTES ====================

// GET /api/email/health - Email service health check
router.get('/health', async (req, res) => {
  try {
    console.log('🔧 Performing email service health check...');
    
    const healthData = {
      service: 'Email Service',
      status: 'checking',
      timestamp: new Date().toISOString(),
      configuration: {
        host: process.env.EMAIL_HOST || 'Not configured',
        port: process.env.EMAIL_PORT || 'Not configured',
        user: process.env.EMAIL_USER ? 'Configured' : 'Not configured',
        fromEmail: process.env.FROM_EMAIL || 'Not configured',
        fromName: process.env.FROM_NAME || 'Not configured'
      }
    };

    // Test connection
    const connectionTest = await testEmailConnection();
    healthData.status = connectionTest.success ? 'healthy' : 'unhealthy';
    healthData.connectionTest = {
      success: connectionTest.success,
      message: connectionTest.message,
      testedAt: new Date().toISOString()
    };

    const statusCode = connectionTest.success ? 200 : 503;
    
    res.status(statusCode).json({
      success: connectionTest.success,
      data: healthData
    });

  } catch (error) {
    console.error('Email health check error:', error);
    res.status(503).json({
      success: false,
      data: {
        service: 'Email Service',
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

// GET /api/email/test - Test email configuration (no actual sending)
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing email configuration...');
    
    const result = await testEmailConnection();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Email service is configured correctly',
        data: {
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          user: process.env.EMAIL_USER,
          secure: process.env.EMAIL_PORT === '465',
          fromEmail: process.env.FROM_EMAIL,
          fromName: process.env.FROM_NAME,
          testedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Email service configuration error',
        error: result.message,
        testedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Email configuration test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing email configuration',
      error: error.message,
      testedAt: new Date().toISOString()
    });
  }
});

// POST /api/email/test-send - Send a test email
router.post('/test-send', emailLimiter, validateTestEmail, handleValidationErrors, async (req, res) => {
  try {
    const { to } = req.body;
    
    console.log(`🧪 Sending test email to: ${to}`);

    const testEmailContent = {
      to,
      subject: 'CRM System - Email Configuration Test',
      body: `Hello!

This is a test email from your CRM system to verify that email functionality is working correctly.

Test Details:
- Sent at: ${new Date().toISOString()}
- From: ${process.env.FROM_EMAIL}
- Service: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}

If you received this email, your email configuration is working properly!

Best regards,
CRM System Team`,
      priority: 'normal'
    };

    const result = await sendEmail(testEmailContent);
    logEmailActivity('Test', to, result.success);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          messageId: result.messageId,
          recipient: to,
          sentAt: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.message,
        code: result.error
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    logEmailActivity('Test', req.body.to, false);
    
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message
    });
  }
});

// ==================== STATISTICS ROUTE ====================

// GET /api/email/stats - Email statistics (if needed for admin dashboard)
router.get('/stats', async (req, res) => {
  try {
    // This could be expanded to include actual statistics from a database
    const stats = {
      service: 'Email Service Statistics',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      configuration: {
        provider: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_PORT === '465'
      },
      rateLimits: {
        generalEmails: '10 per 15 minutes',
        confirmationEmails: '5 per 15 minutes'
      }
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Email stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving email statistics',
      error: error.message
    });
  }
});

module.exports = router;