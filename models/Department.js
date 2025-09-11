const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // department names should not repeat
  }
}, { timestamps: true });

module.exports = mongoose.model("Department", DepartmentSchema);
