// models/Deposit.js
import mongoose from "mongoose";

const depositSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  signature: { type: String, required: true, unique: true },
  nonce: { type: String, required: true },
  referralAddress: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.models.Deposit || mongoose.model("Deposit", depositSchema);