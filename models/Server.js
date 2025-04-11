const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  ownerId: {
    type: String,
    required: true
  },
  staffRoles: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Server', serverSchema);