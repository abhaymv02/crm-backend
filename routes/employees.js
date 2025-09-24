const express = require("express");
const multer = require("multer");
const path = require("path");
const Employee = require("../models/Employee");
const User = require("../models/User"); // 👈 import users model

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

// ------------------- Routes -------------------
// Add Employee
router.post("/", upload.single("profilePic"), async (req, res) => {
  try {
    console.log("📥 Employee request received:", req.body);

    // 1️⃣ Create employee
    const newEmployee = new Employee({
      name: req.body.name,
      department: req.body.department,
      designation: req.body.designation,
      username: req.body.username,
      password: req.body.password,
      email: req.body.email,
      phone: req.body.phone,
      dob: req.body.dob,
      address: req.body.address,
      profilePic: req.file ? req.file.filename : null,
    });

    await newEmployee.save();

    // 2️⃣ Also create login user
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: "employee", // 👈 default role
    });

    await newUser.save();

    res.status(201).json({ message: "✅ Employee & User added successfully" });
  } catch (err) {
    console.error("❌ Error adding employee:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get All Employees
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", upload.single("profilePic"), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    employee.name = req.body.name || employee.name;
    employee.department = req.body.department || employee.department;
    employee.designation = req.body.designation || employee.designation;
    employee.email = req.body.email || employee.email;
    employee.phone = req.body.phone || employee.phone;
    employee.address = req.body.address || employee.address;
    if (req.file) {
      employee.profilePic = req.file.filename;
    }

    await employee.save();
    res.status(200).json({ success: true, data: employee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
