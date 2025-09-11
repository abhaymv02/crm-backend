const express = require("express");
const jwt = require("jsonwebtoken");
const Task = require("../models/Task");
const Employee = require("../models/Employee");

const router = express.Router();
const SECRET_KEY = "my_secret_key";

// ---------------- Helper to decode token ----------------
function getUserFromToken(req) {
  const authHeader = req.headers["authorization"];
  console.log("🔎 Incoming Authorization header:", authHeader || "(none)");

  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    console.warn("❌ No token found in request headers");
    return null;
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY); // { id, username, email, role }
    console.log("🧩 Decoded JWT payload:", decoded);

    if (!decoded.username || !decoded.role) {
      console.warn("⚠️ Token decoded but missing username/role:", decoded);
    }

    return decoded;
  } catch (err) {
    console.warn("❌ Invalid or expired token:", err.message);
    return null;
  }
}

// ---------------- Add Task ----------------
router.post("/", async (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    let { title, description, priority, assignedTo, endDate, status } = req.body;

    // Normalize assignedTo if ObjectId
    if (assignedTo && assignedTo.match(/^[0-9a-fA-F]{24}$/)) {
      const emp = await Employee.findById(assignedTo);
      if (emp) assignedTo = emp.username;
    }

    const newTask = new Task({
      title,
      description,
      priority,
      assignedTo,
      endDate,
      status: status || "Pending",
    });

    await newTask.save();

    console.log(`📌 ${user.username || "unknown"} (${user.role}) created task "${newTask.title}"`);
    res.json({ success: true, task: newTask });
  } catch (err) {
    console.error("❌ Error adding task:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- Get Tasks ----------------
router.get("/", async (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    let query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (user.role !== "admin") {
      query.assignedTo = user.username;
    } else if (req.query.assignedTo) {
      query.assignedTo = req.query.assignedTo;
    }

    const tasks = await Task.find(query);

    console.log(`📌 ${user.username || "unknown"} (${user.role}) fetched ${tasks.length} tasks with query`, query);

    res.json({ success: true, tasks });
  } catch (err) {
    console.error("❌ Error fetching tasks:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- Update Task ----------------
router.put("/:id", async (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const { title, description, priority, assignedTo, endDate, status } = req.body;
    const updates = {};

    if (title) updates.title = title;
    if (description) updates.description = description;
    if (priority) updates.priority = priority;
    if (endDate) updates.endDate = endDate;
    if (status) updates.status = status;

    if (assignedTo) {
      if (assignedTo.match(/^[0-9a-fA-F]{24}$/)) {
        const emp = await Employee.findById(assignedTo);
        if (emp) updates.assignedTo = emp.username;
      } else {
        updates.assignedTo = assignedTo;
      }
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    console.log(`✏️ ${user.username || "unknown"} (${user.role}) updated task ${req.params.id}`);
    res.json({ success: true, task });
  } catch (err) {
    console.error("❌ Error updating task:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------- Delete Task ----------------
router.delete("/:id", async (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    console.log(`🗑️ ${user.username || "unknown"} (${user.role}) deleted task ${req.params.id}`);
    res.json({ success: true, message: "Task deleted" });
  } catch (err) {
    console.error("❌ Error deleting task:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
