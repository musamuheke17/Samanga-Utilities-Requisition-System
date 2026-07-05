const mongoose = require('mongoose');

const requisitionSchema = new mongoose.Schema({
  // === PROJECT INFORMATION ===
  projectName: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  voucherNumber: {
    type: String,
    required: [true, 'Voucher number is required'],
    unique: true,
    trim: true
  },

  // === ITEMS (Editable by Procurement) ===
  items: [{
    itemName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    originalQuantity: {
      type: Number,
      default: 0
    },
    unitPrice: {
      type: Number,
      default: 0
    },
    originalUnitPrice: {
      type: Number,
      default: 0
    },
    totalPrice: {
      type: Number,
      default: 0
    },
    // Track who edited and when
    priceEditedBy: String,
    priceEditedDate: Date,
    quantityEditedBy: String,
    quantityEditedDate: Date
  }],

  // === REQUESTOR INFO ===
  requestor: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    department: String
  },

  // === AUTO-ROUTING STATUS ===
  status: {
    type: String,
    enum: [
      'pending',
      'supervisor_approved',
      'procurement_approved',
      'ceo_approved',
      'manager_approved',
      'finance_approved',
      'completed',
      'rejected'
    ],
    default: 'pending'
  },

  // === APPROVAL HISTORY ===
  approvals: [{
    role: {
      type: String,
      enum: ['supervisor', 'procurement', 'ceo', 'manager', 'finance']
    },
    approverEmail: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    comment: {
      type: String,
      default: ''
    },
    date: Date
  }],

  // === TRACKING HISTORY ===
  trackingHistory: [{
    action: String,
    fromRole: String,
    toRole: String,
    comment: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],

  // === SYSTEM FIELDS ===
  referenceNumber: {
    type: String,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate reference number
requisitionSchema.pre('save', function(next) {
  if (!this.referenceNumber) {
    const prefix = 'SAM-';
    const random = Math.floor(100000 + Math.random() * 900000);
    this.referenceNumber = prefix + random;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Requisition', requisitionSchema);