require("dotenv").config();
const nodemailer = require("nodemailer");

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // false for port 587 (TLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  logger: true,
  debug: true,
});

// Test sending a plain text email
async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: `"Customer Support Team" <${process.env.FROM_EMAIL}>`,
      to: "abhaymvfke@gmail.com", // change to your test recipient
      subject: "Test Email from CRM Backend",
      text: "Hello! This is a test email to verify SMTP is working.",
    });
    console.log("✅ Test email sent:", info.messageId);
  } catch (err) {
    console.error("❌ Test email error:", err);
  }
}

testEmail();
