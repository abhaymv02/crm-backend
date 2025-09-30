require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "",
  user: process.env.DB_USER || "vivcomae_Task",
  password: process.env.DB_PASSWORD || "Vivcom@123",
  database: process.env.DB_NAME || "vivcomae_Task",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(conn => {
    console.log("✅ Connected to MySQL");
    conn.release();
  })
  .catch(err => {
    console.error("❌ MySQL connection error:", err);
    process.exit(1);
  });

module.exports = pool;
