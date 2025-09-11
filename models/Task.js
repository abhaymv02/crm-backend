const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  priority: { 
    type: String, 
    enum: ["Low", "Medium", "Hard", "Critical"], 
    default: "Low" 
  },
  status: { 
    type: String, 
    enum: ["Pending", "In Progress", "Completed"], 
    default: "Pending" 
  },
  assignedTo: { 
    type: String,   // store username for easier filtering
    required: true 
  },
  endDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Task", TaskSchema);
