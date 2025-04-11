const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    required: true,
    enum: ['technical', 'billing', 'general', 'feature-request']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  staffNotes: [{
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  updates: [{
    message: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    content: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    url: String
  }],
  slaDeadline: {
    type: Date,
    default: function () {
      const now = new Date();
      return new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours from creation
    }
  },
  escalated: {
    type: Boolean,
    default: false
  },
  serverId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
ticketSchema.index({ user: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);