// models/Deposit.js
import mongoose from "mongoose";

const DepositSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  signature: { type: String, required: true },
  nonce: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.models.Deposit || mongoose.model("Deposit", DepositSchema);