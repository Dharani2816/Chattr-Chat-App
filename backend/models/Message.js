const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId:    { type: String, required: true },
  username:  { type: String, required: true },
  text:      { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Compound index for fast history queries per room
messageSchema.index({ roomId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
