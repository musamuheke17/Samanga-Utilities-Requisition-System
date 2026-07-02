const mongoose = require('mongoose');

const requisitionSchema = new mongoose.Schema({
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
    unitPrice: {
      type: Number,
      default: 0
    },
    totalPrice: {
      type: Number,
      default: 0
    }
  }],
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
  status: {
    type: String,
    enum: ['pending', 'supervisor_approved', 'manager_approved', 'ceo_approved', 'finance_approved', 'completed', 'rejected'],
    default: 'pending'
  },
  approvals: [{
    role: {
      type: String,
      enum: ['supervisor', 'manager', 'ceo', 'finance']
    },
    approverEmail: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    comment: String,
    date: Date
  }],
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