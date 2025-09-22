const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema({
  // ==================== CUSTOMER INFORMATION ====================
  name: { 
    type: String, 
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  
  contact: { 
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[\d\s\-\+\(\)]{10,15}$/.test(v);
      },
      message: 'Contact number must be 10-15 characters'
    }
  },
  
  company: { 
    type: String,
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },

  // ==================== COMPLAINT DETAILS ====================
  category: { 
    type: String, 
    required: [true, 'Category is required'],
    enum: {
      values: ['CCTV', 'Home Automation', 'Motion Works', 'General'],
      message: 'Category must be one of: CCTV, Home Automation, Motion Works, or General'
    },
    default: 'General'
  },
  
  complaint: { 
    type: String, 
    required: [true, 'Complaint description is required'],
    trim: true,
    maxlength: [2000, 'Complaint cannot exceed 2000 characters'],
    minlength: [10, 'Complaint must be at least 10 characters']
  },

  // ==================== TRACKING & STATUS ====================
  reference: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  status: { 
    type: String, 
    enum: {
      values: ['pending', 'in-progress', 'resolved', 'closed'],
      message: 'Status must be one of: pending, in-progress, resolved, closed'
    },
    default: "pending",
    index: true
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', // Keep your existing reference
    default: null 
  },
  
  assignedAt: {
    type: Date,
    default: null
  },

  // ==================== RESOLUTION ====================
  resolution: {
    type: String,
    trim: true,
    maxlength: [1000, 'Resolution cannot exceed 1000 characters']
  },
  
  resolvedAt: {
    type: Date,
    default: null
  },

  // ==================== EMAIL TRACKING ====================
  confirmationEmailSent: {
    type: Boolean,
    default: false
  },
  
  emailsSent: [{
    type: {
      type: String,
      enum: ['confirmation', 'update', 'resolution'],
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    messageId: String,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed'],
      default: 'sent'
    }
  }],

  // ==================== NOTES & UPDATES ====================
  notes: [{
    note: {
      type: String,
      required: true,
      maxlength: [500, 'Note cannot exceed 500 characters']
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    isPublic: {
      type: Boolean,
      default: false // Internal notes by default
    }
  }],

  // ==================== TIMESTAMPS ====================
  date: { 
    type: Date, 
    default: Date.now 
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false, // We're handling timestamps manually
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES FOR PERFORMANCE ====================
ComplaintSchema.index({ email: 1, date: -1 });
ComplaintSchema.index({ category: 1, status: 1 });
ComplaintSchema.index({ assignedTo: 1, status: 1 });
ComplaintSchema.index({ date: -1 });
ComplaintSchema.index({ reference: 1 }, { unique: true });

// ==================== VIRTUALS ====================
// Calculate age in days
ComplaintSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.date) / (1000 * 60 * 60 * 24));
});

// Check if overdue (more than 3 days for high priority, 7 days for others)
ComplaintSchema.virtual('isOverdue').get(function() {
  const days = this.ageInDays;
  const limit = this.priority === 'high' || this.priority === 'critical' ? 3 : 7;
  return days > limit && this.status !== 'resolved' && this.status !== 'closed';
});

// ==================== MIDDLEWARE ====================
// Update timestamps before saving
ComplaintSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Auto-set resolved timestamp
  if (this.isModified('status') && this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  
  // Set assignment timestamp
  if (this.isModified('assignedTo') && this.assignedTo && !this.assignedAt) {
    this.assignedAt = new Date();
  }
  
  next();
});

// ==================== STATIC METHODS ====================
// Generate unique reference number
ComplaintSchema.statics.generateReference = function() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CMP-${timestamp}-${random}`;
};

// Find by customer email
ComplaintSchema.statics.findByCustomer = function(email) {
  return this.find({ email: email.toLowerCase() }).sort({ date: -1 });
};

// Get basic statistics
ComplaintSchema.statics.getStats = async function() {
  const [total, pending, inProgress, resolved] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ status: 'pending' }),
    this.countDocuments({ status: 'in-progress' }),
    this.countDocuments({ status: 'resolved' })
  ]);
  
  return {
    total,
    pending,
    inProgress,
    resolved,
    closed: total - pending - inProgress - resolved
  };
};

// ==================== INSTANCE METHODS ====================
// Add a note to the complaint
ComplaintSchema.methods.addNote = function(note, userId, isPublic = false) {
  this.notes.push({
    note: note,
    addedBy: userId,
    addedAt: new Date(),
    isPublic: isPublic
  });
  return this.save();
};

// Update status with validation
ComplaintSchema.methods.updateStatus = function(newStatus, resolution = '') {
  const validTransitions = {
    'pending': ['in-progress', 'closed'],
    'in-progress': ['resolved', 'pending', 'closed'],
    'resolved': ['closed'],
    'closed': [] // Cannot change from closed
  };
  
  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(`Cannot change status from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  if (newStatus === 'resolved' && resolution) {
    this.resolution = resolution;
  }
  
  return this.save();
};

// Assign to employee
ComplaintSchema.methods.assignTo = function(employeeId) {
  this.assignedTo = employeeId;
  this.assignedAt = new Date();
  
  // Auto-update status if currently pending
  if (this.status === 'pending') {
    this.status = 'in-progress';
  }
  
  return this.save();
};

// Track email sent
ComplaintSchema.methods.trackEmailSent = function(type, messageId, status = 'sent') {
  this.emailsSent.push({
    type: type,
    messageId: messageId,
    status: status,
    sentAt: new Date()
  });
  
  if (type === 'confirmation') {
    this.confirmationEmailSent = true;
  }
  
  return this.save();
};

module.exports = mongoose.model("Complaint", ComplaintSchema);