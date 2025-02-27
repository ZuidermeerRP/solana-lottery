import mongoose from "mongoose";

const winnerSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  payoutSignature: { type: String, unique: true },
  drawnAt: { type: Date, default: Date.now },
});

export default mongoose.models.Winner || mongoose.model("Winner", winnerSchema);