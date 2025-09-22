const express = require("express");
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Complaint = require("../models/Complaint");
const { sendComplaintConfirmation } = require('../services/emailService');

// ==================== RATE LIMITING ====================
// Prevent complaint spam - only for POST route
const complaintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 complaints per 15 minutes
  message: {
    success: false,
    message: 'Too many complaints submitted. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST' // Only limit POST requests
});

// ==================== HELPER FUNCTIONS ====================
const validateComplaintData = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email address is required');
  }
  
  if (!data.category || !['CCTV', 'Home Automation', 'Motion Works', 'General'].includes(data.category)) {
    errors.push('Valid category is required');
  }
  
  if (!data.complaint || data.complaint.trim().length < 10) {
    errors.push('Complaint description must be at least 10 characters');
  }
  
  return errors;
};

// ==================== ROUTES ====================

// POST new complaint - ENHANCED VERSION
router.post("/", complaintLimiter, async (req, res) => {
  try {
    console.log(`📝 New complaint submission from: ${req.body.email}`);
    
    // Validate input data
    const validationErrors = validateComplaintData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Generate unique reference number
    let reference;
    let attempts = 0;
    const maxAttempts = 5;
    
    do {
      reference = Complaint.generateReference();
      const existing = await Complaint.findOne({ reference });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      return res.status(500).json({
        success: false,
        message: 'Unable to generate unique reference. Please try again.'
      });
    }

    // Create complaint with reference
    const complaintData = {
      ...req.body,
      reference: reference,
      name: req.body.name?.trim(),
      email: req.body.email?.toLowerCase().trim(),
      contact: req.body.contact?.trim() || '',
      company: req.body.company?.trim() || '',
      complaint: req.body.complaint?.trim()
    };

    const complaint = new Complaint(complaintData);
    const savedComplaint = await complaint.save();
    
    console.log(`✅ Complaint saved with reference: ${reference}`);

    // Send confirmation email (non-blocking)
    let emailResult = { success: false, message: 'Not attempted' };
    
    try {
      emailResult = await sendComplaintConfirmation({
        name: savedComplaint.name,
        email: savedComplaint.email,
        contact: savedComplaint.contact,
        company: savedComplaint.company,
        category: savedComplaint.category,
        complaint: savedComplaint.complaint,
        reference: savedComplaint.reference
      });

      // Track email in database
      if (emailResult.success) {
        await savedComplaint.trackEmailSent('confirmation', emailResult.messageId, 'sent');
        console.log(`📧 Confirmation email sent for ${reference}`);
      } else {
        await savedComplaint.trackEmailSent('confirmation', null, 'failed');
        console.log(`❌ Confirmation email failed for ${reference}: ${emailResult.message}`);
      }
      
    } catch (emailError) {
      console.error(`❌ Email service error for ${reference}:`, emailError.message);
      emailResult = { success: false, message: emailError.message };
      
      try {
        await savedComplaint.trackEmailSent('confirmation', null, 'failed');
      } catch (dbError) {
        console.error('Database update error:', dbError.message);
      }
    }

    // Always return success if complaint was saved (even if email failed)
    res.status(201).json({ 
      success: true, 
      message: "Complaint submitted successfully",
      data: {
        id: savedComplaint._id,
        reference: savedComplaint.reference,
        status: savedComplaint.status,
        emailSent: emailResult.success,
        emailMessage: emailResult.message
      }
    });

  } catch (err) {
    console.error('Error submitting complaint:', err);
    
    // Handle specific mongoose errors
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate reference generated. Please try again.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while submitting complaint"
    });
  }
});

// GET complaints (all, by assignedTo ID, or by assignedEmail) - ENHANCED VERSION
router.get("/", async (req, res) => {
  try {
    const { 
      assignedTo, 
      assignedEmail, 
      status, 
      category, 
      page = 1, 
      limit = 10,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;
    
    let filter = {};

    // Build filter object
    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }
    if (status) {
      filter.status = status;
    }
    if (category) {
      filter.category = category;
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { complaint: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination setup
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    let complaints = await Complaint.find(filter)
      .populate("assignedTo", "name email department")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean for better performance

    // Filter by email after population if needed
    if (assignedEmail) {
      complaints = complaints.filter(
        (c) => c.assignedTo?.email?.toLowerCase() === assignedEmail.toLowerCase()
      );
    }

    // Get total count for pagination
    const total = await Complaint.countDocuments(filter);

    res.json({ 
      success: true, 
      data: {
        complaints,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: skip + complaints.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
    
  } catch (err) {
    console.error('Error fetching complaints:', err);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching complaints: " + err.message 
    });
  }
});

// GET single complaint by ID or reference
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    let complaint;

    // Check if identifier looks like a MongoDB ObjectId or a reference
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId
      complaint = await Complaint.findById(identifier)
        .populate("assignedTo", "name email department");
    } else {
      // Assume it's a reference number
      complaint = await Complaint.findOne({ reference: identifier })
        .populate("assignedTo", "name email department");
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    res.json({
      success: true,
      data: complaint
    });

  } catch (err) {
    console.error('Error fetching complaint:', err);
    res.status(500).json({
      success: false,
      message: "Error fetching complaint: " + err.message
    });
  }
});

// PUT assign complaint to employee - ENHANCED VERSION
router.put("/:id/assign", async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, assignedBy } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Find the complaint first
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Use the model method for assignment
    await complaint.assignTo(employeeId);
    
    // Populate and return updated complaint
    const updatedComplaint = await Complaint.findById(id)
      .populate("assignedTo", "name email department");

    // Add internal note about assignment
    if (assignedBy) {
      await complaint.addNote(`Complaint assigned to ${updatedComplaint.assignedTo?.name || 'employee'}`, assignedBy, false);
    }

    console.log(`📋 Complaint ${complaint.reference} assigned to ${updatedComplaint.assignedTo?.name}`);

    res.json({
      success: true,
      message: "Complaint assigned successfully",
      data: updatedComplaint,
    });
    
  } catch (err) {
    console.error("Assignment error:", err);
    res.status(500).json({
      success: false,
      message: "Error assigning complaint: " + err.message,
    });
  }
});

// PATCH update complaint status - ENHANCED VERSION
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, updatedBy } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Validate status
    const validStatuses = ["pending", "in-progress", "resolved", "closed"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Find complaint
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Update status using model method
    try {
      await complaint.updateStatus(status.toLowerCase(), resolution);
    } catch (statusError) {
      return res.status(400).json({
        success: false,
        message: statusError.message
      });
    }

    // Add note about status change
    if (updatedBy) {
      const statusNote = `Status changed to ${status}${resolution ? `. Resolution: ${resolution}` : ''}`;
      await complaint.addNote(statusNote, updatedBy, false);
    }

    // Get updated complaint
    const updatedComplaint = await Complaint.findById(id)
      .populate("assignedTo", "name email department");

    console.log(`📋 Complaint ${complaint.reference} status updated to: ${status}`);

    res.json({
      success: true,
      message: "Complaint status updated successfully",
      data: updatedComplaint,
    });
    
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating complaint status: " + err.message,
    });
  }
});

// POST add note to complaint
router.post("/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const { note, addedBy, isPublic = false } = req.body;

    if (!note || !addedBy) {
      return res.status(400).json({
        success: false,
        message: "Note content and author are required"
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    await complaint.addNote(note, addedBy, isPublic);

    const updatedComplaint = await Complaint.findById(id)
      .populate("assignedTo", "name email department")
      .populate("notes.addedBy", "name email");

    res.status(201).json({
      success: true,
      message: "Note added successfully",
      data: updatedComplaint
    });

  } catch (err) {
    console.error("Add note error:", err);
    res.status(500).json({
      success: false,
      message: "Error adding note: " + err.message
    });
  }
});

// GET complaints statistics
router.get("/stats/dashboard", async (req, res) => {
  try {
    const stats = await Complaint.getStats();
    
    // Additional statistics
    const [recentComplaints, overdueCount] = await Promise.all([
      Complaint.find()
        .populate("assignedTo", "name")
        .sort({ date: -1 })
        .limit(5)
        .select("reference name category status date priority"),
      
      Complaint.countDocuments({
        status: { $nin: ['resolved', 'closed'] },
        date: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days ago
      })
    ]);

    res.json({
      success: true,
      data: {
        ...stats,
        overdue: overdueCount,
        recent: recentComplaints
      }
    });

  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics: " + err.message
    });
  }
});

module.exports = router;