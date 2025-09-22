const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Complaint Confirmation Email
async function sendComplaintConfirmation({ name, email, contact, company, category, complaint, reference }) {
  try {
    const refNumber = reference || `CMP-${Date.now()}`; // ✅ Generate once

    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Load HTML template
    let template = await fs.readFile(
      path.join(__dirname, '../templates/complaintConfirmation.html'),
      'utf8'
    );

    // Replace placeholders
    template = template
      .replace('{{name}}', name)
      .replace('{{company}}', company || 'N/A')
      .replace('{{category}}', category || 'General')
      .replace('{{contact}}', contact || 'N/A')
      .replace('{{date}}', date)
      .replace('{{reference}}', refNumber)
      .replace('{{fromEmail}}', process.env.FROM_EMAIL);

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: `Complaint Received #${refNumber} - Thank You for Reaching Out`,
      html: template,
      text: `
Dear ${name},

Thank you for submitting your complaint. We have successfully received your request regarding ${category || 'your issue'} and our support team is reviewing it. We aim to respond within 24-48 hours.

Your Submission Details:
- Name: ${name}
- Company: ${company || 'N/A'}
- Category: ${category || 'General'}
- Contact: ${contact || 'N/A'}
- Date: ${date}

Your complaint reference number is #${refNumber}. Please keep this for your records.

For urgent assistance, call our support line at +1-800-123-4567 (available 24/7).

Best regards,
Customer Support Team
${process.env.FROM_EMAIL}

This is an automated message. Please do not reply directly to this email.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId, reference: refNumber };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return { success: false, message: error.message };
  }
}

// Generic Email
async function sendEmail({ to, subject, body, fromName = process.env.FROM_NAME, fromEmail = process.env.FROM_EMAIL, isConfirmation = false, complaintData = null }) {
  try {
    if (isConfirmation && complaintData) {
      return await sendComplaintConfirmation({ ...complaintData, email: to });
    }

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text: body,
      html: `<div>${body.replace(/\n/g, '<br>')}</div>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, message: error.message };
  }
}

module.exports = { sendEmail, sendComplaintConfirmation };
