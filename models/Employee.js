const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  department: { type: String, required: true },
  designation: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  dob: { type: String, required: true }, // keep as string for dd/mm/yyyy
  address: { type: String, required: true },
  profilePic: { type: String }, // store image filename
});

module.exports = mongoose.model("Employee", EmployeeSchema);
