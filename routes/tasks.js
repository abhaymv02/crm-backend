const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db"); // MySQL connection

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || "my_secret_key";

// ---------------- Helper to decode token ----------------
function getUserFromToken(req) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
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

    let assignedToId = null;
    if (assignedTo) {
      const [empRows] = await pool.query("SELECT id FROM employees WHERE username = ? LIMIT 1", [assignedTo]);
      if (empRows.length > 0) assignedToId = empRows[0].id;
    }

    const [result] = await pool.query(
      `INSERT INTO tasks (title, description, priority, assigned_to, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, priority, assignedToId, endDate, status || "pending"]
    );

    const taskId = result.insertId;

    const [taskRows] = await pool.query(
      `SELECT t.*, e.username AS assigned_username, e.email AS assigned_email
       FROM tasks t
       LEFT JOIN employees e ON t.assigned_to = e.id
       WHERE t.id = ?`,
      [taskId]
    );

    console.log(`📌 ${user.username || "unknown"} (${user.role}) created task "${title}"`);

    res.json({ success: true, task: taskRows[0] });
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
    let query = `
      SELECT t.*, e.username AS assigned_username, e.email AS assigned_email
      FROM tasks t
      LEFT JOIN employees e ON t.assigned_to = e.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.status) {
      query += " AND t.status = ?";
      params.push(req.query.status);
    }

    if (user.role !== "admin") {
      query += " AND e.username = ?";
      params.push(user.username);
    } else if (req.query.assignedTo) {
      query += " AND e.username = ?";
      params.push(req.query.assignedTo);
    }

    const [tasks] = await pool.query(query, params);

    console.log(`📌 ${user.username || "unknown"} (${user.role}) fetched ${tasks.length} tasks`);

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
    const updates = [];
    const params = [];

    if (title) {
      updates.push("title = ?");
      params.push(title);
    }
    if (description) {
      updates.push("description = ?");
      params.push(description);
    }
    if (priority) {
      updates.push("priority = ?");
      params.push(priority);
    }
    if (endDate) {
      updates.push("end_date = ?");
      params.push(endDate);
    }
    if (status) {
      updates.push("status = ?");
      params.push(status);
    }
    if (assignedTo) {
      const [empRows] = await pool.query("SELECT id FROM employees WHERE username = ? LIMIT 1", [assignedTo]);
      updates.push("assigned_to = ?");
      params.push(empRows.length ? empRows[0].id : null);
    }

    params.push(req.params.id);

    const [result] = await pool.query(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const [updatedTask] = await pool.query(
      `SELECT t.*, e.username AS assigned_username, e.email AS assigned_email
       FROM tasks t
       LEFT JOIN employees e ON t.assigned_to = e.id
       WHERE t.id = ?`,
      [req.params.id]
    );

    console.log(`✏️ ${user.username || "unknown"} (${user.role}) updated task ${req.params.id}`);

    res.json({ success: true, task: updatedTask[0] });
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
    const [result] = await pool.query("DELETE FROM tasks WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
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
