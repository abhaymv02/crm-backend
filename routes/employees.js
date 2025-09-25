const express = require("express");
const multer = require("multer");
const path = require("path");
const pool = require("../db"); // MySQL connection

const router = express.Router();

// ------------------- Multer Setup -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ------------------- Add Employee -------------------
router.post("/", upload.single("profilePic"), async (req, res) => {
  try {
    console.log("📥 Employee request received:", req.body);

    const {
      name,
      department,
      designation,
      username,
      password,
      email,
      phone,
      dob,
      address
    } = req.body;

    const profilePic = req.file ? req.file.filename : null;

    // Insert into employees
    const [result] = await pool.query(
      `INSERT INTO employees
      (name, department_id, designation, username, password, email, phone, dob, address, profile_pic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, department, designation, username, password, email, phone, dob, address, profilePic]
    );

    const employeeId = result.insertId;

    // Also create login user
    await pool.query(
      `INSERT INTO users (username, email, password, role)
       VALUES (?, ?, ?, 'employee')`,
      [username, email, password]
    );

    res.status(201).json({ message: "✅ Employee & User added successfully", employeeId });
  } catch (err) {
    console.error("❌ Error adding employee:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ------------------- Get All Employees -------------------
router.get("/", async (req, res) => {
  try {
    const [employees] = await pool.query(
      `SELECT e.*, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id`
    );
    res.json(employees);
  } catch (err) {
    console.error("❌ Error fetching employees:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ------------------- Update Employee -------------------
router.put("/:id", upload.any(), async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM employees WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = existing[0];
    const body = req.body;

    const updatedFields = {
      name: body.name || employee.name,
      department_id: body.department || employee.department_id,
      designation: body.designation || employee.designation,
      email: body.email || employee.email,
      phone: body.phone || employee.phone,
      address: body.address || employee.address,
      profile_pic: req.files && req.files.length > 0 ? req.files[0].filename : employee.profile_pic
    };

    await pool.query(
      `UPDATE employees SET name = ?, department_id = ?, designation = ?, email = ?, phone = ?, address = ?, profile_pic = ? WHERE id = ?`,
      [
        updatedFields.name,
        updatedFields.department_id,
        updatedFields.designation,
        updatedFields.email,
        updatedFields.phone,
        updatedFields.address,
        updatedFields.profile_pic,
        id
      ]
    );

    const [updatedEmployee] = await pool.query(
      `SELECT e.*, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id = ?`,
      [id]
    );

    res.status(200).json({ success: true, data: updatedEmployee[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
