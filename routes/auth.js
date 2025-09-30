const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db"); // MySQL connection

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || "my_secret_key";

// ---------------------- LOGIN ----------------------
router.post("/login", async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if ((!email && !username) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/Username and password required"
      });
    }

    email = email?.trim().toLowerCase();
    username = username?.trim();

    // MySQL query to find user by email or username
    const [rows] = await pool.query(
      "SELECT * FROM auth_user WHERE email = ? OR username = ? LIMIT 1",
      [email || "", username || ""]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // ⚠️ Plaintext check — recommend bcrypt for production
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    const safeUsername = user.username || user.email || user.id.toString();
    const safeEmail = user.email || "";
    const safeRole = user.role || "employee";

    // Create token
    const token = jwt.sign(
      {
        id: user.id.toString(),
        username: safeUsername,
        email: safeEmail,
        role: safeRole
      },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    console.log(`✅ User logged in: ${safeUsername} (${safeRole})`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: safeUsername,
        email: safeEmail,
        role: safeRole
      }
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------------- VERIFY TOKEN ----------------------
router.post("/verifyToken", (req, res) => {
  const { token } = req.body;
  if (!token)
    return res.json({ success: false, message: "No token provided" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.json({
      success: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role
      }
    });
  } catch (err) {
    console.warn("❌ Invalid or expired token");
    res.json({ success: false, message: "Invalid or expired token" });
  }
});

module.exports = router;
