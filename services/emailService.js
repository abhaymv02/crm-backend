const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Enhanced transporter configuration with better error handling
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_PORT == '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  },
  pool: true, // Use pooled connections
  maxConnections: 5,
  maxMessages: 10,
  rateDelta: 1000, // Rate limit: 1 second between messages
  rateLimit: 5 // Rate limit: max 5 messages per rateDelta
});

// Verify transporter configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter configuration error:', error);
  } else {
    console.log('✅ Email transporter is ready to send emails');
  }
});

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
    .trim()
    .substring(0, 1000); // Limit length to prevent abuse
};

// HTML template fallback (if template file doesn't exist)
const getDefaultTemplate = (data) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complaint Confirmation</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6; 
                margin: 0; 
                padding: 0; 
                background-color: #f8f9fa;
                color: #333;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 2rem; 
                text-align: center;
            }
            .content { padding: 2rem; }
            .footer { 
                background: #f8f9fa; 
                padding: 1rem 2rem; 
                text-align: center; 
                font-size: 0.9em; 
                color: #6c757d;
            }
            .reference-box {
                background: #e3f2fd;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: center;
                border-left: 4px solid #2196f3;
            }
            .details-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin: 20px 0;
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
            }
            .detail-item {
                padding: 5px 0;
            }
            .label {
                font-weight: bold;
                color: #495057;
            }
            .next-steps {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
            }
            .next-steps h3 {
                margin-top: 0;
                color: #856404;
            }
            .contact-info {
                background: #d1ecf1;
                border: 1px solid #b8daff;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Complaint Received</h1>
                <p>Thank you for reaching out to us</p>
            </div>
            
            <div class="content">
                <p>Dear ${data.name},</p>
                
                <p>We have successfully received your complaint and our support team is reviewing it. We appreciate you taking the time to bring this matter to our attention.</p>
                
                <div class="reference-box">
                    <div class="label">Your Reference Number:</div>
                    <h2 style="margin: 5px 0; color: #2196f3;">#${data.reference}</h2>
                    <small>Please keep this reference number for your records</small>
                </div>
                
                <div class="details-grid">
                    <div class="detail-item">
                        <div class="label">Name:</div>
                        <div>${data.name}</div>
                    </div>
                    <div class="detail-item">
                        <div class="label">Company:</div>
                        <div>${data.company}</div>
                    </div>
                    <div class="detail-item">
                        <div class="label">Category:</div>
                        <div>${data.category}</div>
                    </div>
                    <div class="detail-item">
                        <div class="label">Contact:</div>
                        <div>${data.contact}</div>
                    </div>
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <div class="label">Date Submitted:</div>
                        <div>${data.date}</div>
                    </div>
                </div>
                
                <div class="next-steps">
                    <h3>What happens next?</h3>
                    <ul>
                        <li>🔍 Our team will review your complaint within 24-48 hours</li>
                        <li>📞 We'll contact you via phone or email for any clarifications</li>
                        <li>✅ You'll receive updates on the resolution progress</li>
                        <li>📧 A final resolution email will be sent once completed</li>
                    </ul>
                </div>
                
                <div class="contact-info">
                    <h3>Need urgent assistance?</h3>
                    <p>📞 <strong>Phone:</strong> ${process.env.SUPPORT_PHONE || '+1-800-123-4567'} (Available 24/7)<br>
                    📧 <strong>Email:</strong> ${process.env.SUPPORT_EMAIL || 'support@company.com'}</p>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>${process.env.FROM_NAME || 'Customer Support Team'}</strong><br>
                ${process.env.COMPANY_NAME || 'Your Company'}<br>
                ${data.fromEmail}</p>
                
                <p><small>This is an automated message. Please do not reply directly to this email.<br>
                If you need to add more information to your complaint, please call our support line.</small></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Enhanced email sending function for complaint confirmation
async function sendComplaintConfirmation({ name, email, contact, company, category, complaint, reference }) {
  try {
    // Generate reference if not provided
    const complaintReference = reference || `CMP-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Sanitize inputs to prevent XSS
    const sanitizedData = {
      name: sanitizeInput(name),
      email: email?.toLowerCase().trim(),
      contact: sanitizeInput(contact),
      company: sanitizeInput(company) || 'N/A',
      category: category || 'General',
      complaint: sanitizeInput(complaint),
      reference: complaintReference,
      date,
      fromEmail: process.env.FROM_EMAIL
    };

    let template;
    
    try {
      // Try to read HTML template file
      const templatePath = path.join(__dirname, '../templates/complaintConfirmation.html');
      template = await fs.readFile(templatePath, 'utf8');
      
      // Replace placeholders in template
      template = template
        .replace(/{{name}}/g, sanitizedData.name)
        .replace(/{{company}}/g, sanitizedData.company)
        .replace(/{{category}}/g, sanitizedData.category)
        .replace(/{{contact}}/g, sanitizedData.contact)
        .replace(/{{date}}/g, sanitizedData.date)
        .replace(/{{reference}}/g, sanitizedData.reference)
        .replace(/{{fromEmail}}/g, sanitizedData.fromEmail)
        .replace(/{{complaint}}/g, sanitizedData.complaint || 'Not provided')
        .replace(/{{supportPhone}}/g, process.env.SUPPORT_PHONE || '+1-800-123-4567')
        .replace(/{{supportEmail}}/g, process.env.SUPPORT_EMAIL || 'support@company.com')
        .replace(/{{companyName}}/g, process.env.COMPANY_NAME || 'Your Company');
        
    } catch (templateError) {
      console.warn('⚠️ Could not read template file, using default template:', templateError.message);
      // Use default template if file doesn't exist
      template = getDefaultTemplate(sanitizedData);
    }

    // Enhanced text version
    const textVersion = `
Dear ${sanitizedData.name},

COMPLAINT CONFIRMATION - Reference #${sanitizedData.reference}

Thank you for submitting your complaint. We have successfully received your request regarding ${sanitizedData.category} and our support team is reviewing it. We aim to respond within 24-48 hours.

YOUR SUBMISSION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Name: ${sanitizedData.name}
• Company: ${sanitizedData.company}
• Category: ${sanitizedData.category}
• Contact: ${sanitizedData.contact}
• Date Submitted: ${sanitizedData.date}
• Reference Number: #${sanitizedData.reference}

WHAT HAPPENS NEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Our team will review your complaint within 24-48 hours
2. We'll contact you via phone or email for any clarifications
3. You'll receive updates on the resolution progress
4. A final resolution email will be sent once completed

NEED URGENT ASSISTANCE?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Phone: ${process.env.SUPPORT_PHONE || '+1-800-123-4567'} (Available 24/7)
📧 Email: ${process.env.SUPPORT_EMAIL || 'support@company.com'}

Best regards,
${process.env.FROM_NAME || 'Customer Support Team'}
${process.env.COMPANY_NAME || 'Your Company'}
${sanitizedData.fromEmail}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message. Please do not reply directly to this email.
Keep your reference number #${sanitizedData.reference} for your records.
    `.trim();

    const mailOptions = {
      from: {
        name: process.env.FROM_NAME || 'Customer Support Team',
        address: process.env.FROM_EMAIL
      },
      to: sanitizedData.email,
      subject: `Complaint Received #${sanitizedData.reference} - Thank You for Reaching Out`,
      html: template,
      text: textVersion,
      priority: 'normal',
      headers: {
        'X-Complaint-Reference': sanitizedData.reference,
        'X-Category': sanitizedData.category,
        'X-Mailer': 'CRM-System-v1.0'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`📧 Confirmation email sent to ${sanitizedData.email}:`, info.messageId);
    console.log(`📋 Reference: ${sanitizedData.reference}`);
    
    return { 
      success: true, 
      messageId: info.messageId, 
      reference: sanitizedData.reference,
      emailSent: true,
      recipient: sanitizedData.email
    };
    
  } catch (error) {
    console.error('❌ Error sending confirmation email:', error);
    
    // Enhanced error handling
    let errorMessage = 'Failed to send confirmation email';
    let errorCode = 'EMAIL_SEND_ERROR';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check email credentials.';
      errorCode = 'AUTH_ERROR';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Please check network connection.';
      errorCode = 'CONNECTION_ERROR';
    } else if (error.responseCode === 550) {
      errorMessage = 'Invalid recipient email address.';
      errorCode = 'INVALID_RECIPIENT';
    }
    
    return { 
      success: false, 
      message: errorMessage, 
      error: errorCode,
      details: error.message,
      emailSent: false
    };
  }
}

// Enhanced generic email sending function
async function sendEmail({ 
  to, 
  subject, 
  body, 
  html,
  fromName = process.env.FROM_NAME, 
  fromEmail = process.env.FROM_EMAIL, 
  isConfirmation = false, 
  complaintData = null,
  priority = 'normal' 
}) {
  try {
    // If it's a complaint confirmation, use the specialized function
    if (isConfirmation && complaintData) {
      const result = await sendComplaintConfirmation({ ...complaintData, email: to });
      return result;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return {
        success: false,
        message: 'Invalid email address format',
        error: 'INVALID_EMAIL_FORMAT',
        emailSent: false
      };
    }

    // Sanitize inputs
    const sanitizedSubject = sanitizeInput(subject);
    const sanitizedBody = sanitizeInput(body);

    const mailOptions = {
      from: {
        name: fromName || 'Support Team',
        address: fromEmail || process.env.FROM_EMAIL
      },
      to: to.toLowerCase().trim(),
      subject: sanitizedSubject,
      priority: priority,
      headers: {
        'X-Mailer': 'CRM-System-v1.0'
      }
    };

    // Use provided HTML or convert text to HTML
    if (html) {
      mailOptions.html = html;
      mailOptions.text = sanitizedBody; // Fallback text version
    } else {
      mailOptions.text = sanitizedBody;
      mailOptions.html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            ${sanitizedBody.replace(/\n/g, '<br>')}
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 0.9em; color: #666;">
              Best regards,<br>
              <strong>${fromName || 'Support Team'}</strong><br>
              ${fromEmail || process.env.FROM_EMAIL}
            </p>
          </div>
        </div>
      `;
    }

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`📧 Email sent to ${to}:`, info.messageId);
    
    return { 
      success: true, 
      messageId: info.messageId,
      emailSent: true,
      recipient: to,
      subject: sanitizedSubject
    };
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    
    // Enhanced error handling
    let errorMessage = 'Failed to send email';
    let errorCode = 'EMAIL_SEND_ERROR';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed';
      errorCode = 'AUTH_ERROR';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server';
      errorCode = 'CONNECTION_ERROR';
    } else if (error.responseCode === 550) {
      errorMessage = 'Invalid recipient email address';
      errorCode = 'INVALID_RECIPIENT';
    }
    
    return { 
      success: false, 
      message: errorMessage,
      error: errorCode,
      details: error.message,
      emailSent: false
    };
  }
}

// Test email connection
async function testEmailConnection() {
  try {
    await transporter.verify();
    console.log('✅ Email connection verified successfully');
    return { 
      success: true, 
      message: 'Email connection verified successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Email connection test failed:', error);
    return { 
      success: false, 
      message: error.message,
      error: error.code || 'CONNECTION_TEST_FAILED'
    };
  }
}

// Graceful shutdown
const closeTransporter = () => {
  transporter.close();
  console.log('📧 Email transporter closed');
};

// Handle process termination
process.on('SIGTERM', closeTransporter);
process.on('SIGINT', closeTransporter);

module.exports = { 
  sendEmail, 
  sendComplaintConfirmation,
  testEmailConnection,
  closeTransporter
};