const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();
const sgMail = require("@sendgrid/mail");

// Validate environment variables at startup
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable is not set");
}
if (!process.env.SENDGRID_FROM_EMAIL) {
  throw new Error("SENDGRID_FROM_EMAIL environment variable is not set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send complaint confirmation email
 */
async function sendComplaintConfirmation({ name, email, contact, company, category, complaint, reference }) {
  try {
    const refNumber = reference || `CMP-${Date.now()}`;
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    console.log("📧 Sending complaint confirmation email to:", email, "Ref:", refNumber);

    // Load HTML template
    let template = await fs.readFile(
      path.join(__dirname, "../templates/complaintConfirmation.html"),
      "utf8"
    );

    // Replace placeholders
    template = template
      .replace(/{{name}}/g, name || "N/A")
      .replace(/{{company}}/g, company || "N/A")
      .replace(/{{category}}/g, category || "General")
      .replace(/{{contact}}/g, contact || "N/A")
      .replace(/{{date}}/g, date)
      .replace(/{{reference}}/g, refNumber)
      .replace(/{{fromEmail}}/g, process.env.SENDGRID_FROM_EMAIL);

    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL, // Fixed: Use SENDGRID_FROM_EMAIL
        name: process.env.SENDGRID_FROM_NAME || "Customer Support Team",
      },
      subject: `Complaint Received - Thank You for Reaching Out`,
      text: `
Dear ${name || "Customer"},

Thank you for submitting your complaint. We have successfully received your request regarding ${category || "your issue"} and our support team is reviewing it. We aim to respond within 24-48 hours.

Your Submission Details:
- Name: ${name || "N/A"}
- Company: ${company || "N/A"}
- Category: ${category || "General"}
- Contact: ${contact || "N/A"}
- Date: ${date}

Your complaint reference number is #${refNumber}. Please keep this for your records.

For urgent assistance, call our support line at +1-800-123-4567 (available 24/7).

Best regards,
${process.env.SENDGRID_FROM_NAME || "Customer Support Team"}
${process.env.SENDGRID_FROM_EMAIL}

This is an automated message. Please do not reply directly to this email.
      `,
      html: template,
    };

    console.log("📧 Email message config:", msg); // Debug

    await sgMail.send(msg);

    console.log("✅ Confirmation email sent to:", email);
    return { success: true, reference: refNumber };
  } catch (error) {
    console.error("❌ Error sending confirmation email:", error.message, error);
    return { success: false, message: error.message, reference: refNumber || null };
  }
}

/**
 * Generic email sender
 */
async function sendEmail({ to, subject, body, fromName = process.env.SENDGRID_FROM_NAME, fromEmail = process.env.SENDGRID_FROM_EMAIL, isConfirmation = false, complaintData = null }) {
  try {
    if (isConfirmation && complaintData) {
      return await sendComplaintConfirmation({ ...complaintData, email: to });
    }

    const msg = {
      to,
      from: {
        email: fromEmail || process.env.SENDGRID_FROM_EMAIL,
        name: fromName || process.env.SENDGRID_FROM_NAME || "Customer Support Team",
      },
      subject,
      text: body,
      html: `<div>${body.replace(/\n/g, "<br>")}</div>`,
    };

    console.log("📧 Sending email with config:", msg); // Debug

    await sgMail.send(msg);

    console.log("✅ Email sent successfully to:", to);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending email:", error.message, error);
    return { success: false, message: error.message };
  }
}

module.exports = { sendEmail, sendComplaintConfirmation };