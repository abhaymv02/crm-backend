const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();
const SECRET_KEY = "my_secret_key";

// ---------------------- LOGIN ----------------------
router.post("/login", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Find user by username OR email
    const user = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // ⚠️ Plain text check (use bcrypt in production)
    if (user.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid password" });
    }

    // ✅ Always sign JWT with safe username + role
    const safeUsername = user.username || user.email || user._id.toString();
    const safeRole = user.role || "employee";

    const token = jwt.sign(
      {
        id: user._id,
        username: safeUsername,
        email: user.email || "",
        role: safeRole,
      },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    console.log(`✅ User logged in: ${safeUsername} (${safeRole})`);

    // Send back token + user details
    res.json({
      success: true,
      token,
      role: safeRole,
      user: {
        id: user._id,
        username: safeUsername,
        email: user.email,
        role: safeRole,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------------- VERIFY TOKEN ----------------------
router.post("/verifyToken", (req, res) => {
  const { token } = req.body;
  if (!token) return res.json({ success: false, message: "No token provided" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.json({
      success: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (err) {
    console.warn("❌ Invalid or expired token");
    res.json({ success: false, message: "Invalid or expired token" });
  }
});

module.exports = router;
