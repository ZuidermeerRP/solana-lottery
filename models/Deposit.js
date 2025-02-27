import mongoose from "mongoose";

const depositSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  signature: { type: String, unique: true },
  nonce: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Deposit || mongoose.model("Deposit", depositSchema);