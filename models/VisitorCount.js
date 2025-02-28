// models/VisitorCount.js
import mongoose from 'mongoose';

const visitorCountSchema = new mongoose.Schema({
  _id: { type: String, default: 'visitor-counter' }, // Single document for simplicity
  count: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

export default mongoose.models.VisitorCount || mongoose.model('VisitorCount', visitorCountSchema);