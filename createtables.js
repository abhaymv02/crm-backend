// createTables.js
const pool = require("./db");

(async () => {
  try {
    console.log("🛠 Creating tables...");

    // Departments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      );
    `);

    // Employees table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        department INT,
        designation VARCHAR(255),
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(100),
        dob DATE,
        address TEXT,
        profile_pic VARCHAR(255),
        FOREIGN KEY (department) REFERENCES departments(id) ON DELETE SET NULL
      );
    `);

    // Users table (login credentials)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin','employee') DEFAULT 'employee'
      );
    `);

    // Complaints table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        contact VARCHAR(100),
        company VARCHAR(255),
        category VARCHAR(255) NOT NULL,
        complaint TEXT NOT NULL,
        status ENUM('pending','in-progress','resolved') DEFAULT 'pending',
        assigned_to INT DEFAULT NULL,
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL
      );
    `);

    // Tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority ENUM('low','medium','high') DEFAULT 'medium',
        assigned_to INT,
        end_date DATE,
        status ENUM('pending','in-progress','resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL
      );
    `);

    console.log("✅ All tables created successfully");
    process.exit();
  } catch (err) {
    console.error("❌ Table creation failed:", err);
    process.exit(1);
  }
})();
