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

    // Lookup department ID
    const [deptRows] = await pool.query(
      "SELECT id FROM accounts_department WHERE name = ? LIMIT 1",
      [department]
    );

    if (!deptRows.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid department"
      });
    }

    const departmentId = deptRows[0].id;

    let dobValue = null;
    if (dob) {
      const parsedDate = new Date(dob);
      dobValue = parsedDate.toISOString().split("T")[0];
    }

    // Insert employee
    const [result] = await pool.query(
      `INSERT INTO accounts_employeeprofile
      (name, department_id, designation, username, password, email, phone, dob, address, profile_pic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, departmentId, designation, username, password, email, phone, dobValue, address, profilePic]
    );

    const employeeId = result.insertId;

    // Create login user
    await pool.query(
      `INSERT INTO auth_user (username, email, password, role)
       VALUES (?, ?, ?, 'employee')`,
      [username, email, password]
    );

    res.status(201).json({
      success: true,
      message: "✅ Employee & User added successfully",
      employeeId
    });
  } catch (err) {
    console.error("❌ Error adding employee:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ------------------- Get All Employees -------------------
router.get("/", async (req, res) => {
  try {
    const [employees] = await pool.query(
      `SELECT e.id, e.name, e.username, e.email, e.designation, e.phone, e.address,
              e.dob, e.profile_pic, d.name AS department_name
       FROM accounts_employeeprofile e
       LEFT JOIN accounts_department d ON e.department_id = d.id`
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
      "SELECT * FROM accounts_employeeprofile WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = existing[0];
    const body = req.body;

    // Department handling
    let departmentId = employee.department_id;
    if (body.department) {
      const [deptRows] = await pool.query(
        "SELECT id FROM accounts_department WHERE name = ? LIMIT 1",
        [body.department]
      );
      if (deptRows.length) {
        departmentId = deptRows[0].id;
      } else {
        return res.status(400).json({ success: false, message: "Invalid department" });
      }
    }

    // Date handling
    let dobValue = employee.dob;
    if (body.dob) {
      const parsedDate = new Date(body.dob);
      dobValue = parsedDate.toISOString().split("T")[0];
    }

    const updatedFields = {
      name: body.name || employee.name,
      department_id: departmentId,
      designation: body.designation || employee.designation,
      username: body.username || employee.username,
      email: body.email || employee.email,
      phone: body.phone || employee.phone,
      address: body.address || employee.address,
      dob: dobValue,
      profile_pic: req.files && req.files.length > 0 ? req.files[0].filename : employee.profile_pic
    };

    await pool.query(
      `UPDATE accounts_employeeprofile SET name = ?, department_id = ?, designation = ?, username = ?, email = ?, phone = ?, address = ?, dob = ?, profile_pic = ? WHERE id = ?`,
      [
        updatedFields.name,
        updatedFields.department_id,
        updatedFields.designation,
        updatedFields.username,
        updatedFields.email,
        updatedFields.phone,
        updatedFields.address,
        updatedFields.dob,
        updatedFields.profile_pic,
        id
      ]
    );

    const [updatedEmployee] = await pool.query(
      `SELECT e.id, e.name, e.username, e.email, e.designation, e.phone, e.address,
              e.dob, e.profile_pic, d.name AS department_name
       FROM accounts_employeeprofile e
       LEFT JOIN accounts_department d ON e.department_id = d.id
       WHERE e.id = ?`,
      [id]
    );

    res.status(200).json({ success: true, data: updatedEmployee[0] });
  } catch (err) {
    console.error("❌ Error updating employee:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
