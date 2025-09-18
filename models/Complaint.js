const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  contact: { type: String },
  company: { type: String },
  category: { type: String, required: true },
  complaint: { type: String, required: true },
  status: { type: String, default: "pending" },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', // Change this to 'User' if your employee model is called 'User'
    default: null 
  },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Complaint", ComplaintSchema);