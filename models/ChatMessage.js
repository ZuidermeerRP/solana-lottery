// models/ChatMessage.js
import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  walletAddress: {
    type: String,
    required: true,
  },
});

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);