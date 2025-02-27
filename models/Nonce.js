import mongoose from "mongoose";

const nonceSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  nonce: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: "1h" },
});

export default mongoose.models.Nonce || mongoose.model("Nonce", nonceSchema);