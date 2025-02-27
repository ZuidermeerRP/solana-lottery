import { createHandler } from "../../../lib/handler";
import Winner from "../../../models/Winner";
import mongoose from "mongoose";

let cachedConnection = null;

const connectToMongo = async () => {
  if (cachedConnection) return cachedConnection;
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not defined");
  cachedConnection = await mongoose.connect(process.env.MONGO_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
  });
  console.log("MongoDB connected");
  return cachedConnection;
};

export const GET = createHandler(async () => {
  console.log("Fetching latest winner...");
  await connectToMongo();
  const latestWinner = await Winner.findOne().sort({ drawnAt: -1 });
  console.log("Latest winner:", latestWinner);
  return {
    winner: latestWinner ? latestWinner.walletAddress : null,
    amount: latestWinner ? latestWinner.amount : 0,
    drawnAt: latestWinner ? latestWinner.drawnAt : null,
  };
});