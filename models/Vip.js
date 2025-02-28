// models/Vip.js
import mongoose from "mongoose";

const VipSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true },
  activatedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true }, // 24 hours from activation
});

export default mongoose.models.Vip || mongoose.model("Vip", VipSchema);