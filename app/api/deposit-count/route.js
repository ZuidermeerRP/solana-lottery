// app/api/deposit-count/route.js
import { NextResponse } from "next/server";
import Deposit from "../../../models/Deposit";
import mongoose from "mongoose";

const connectToMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is not defined");
    }
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
      });
      console.log("MongoDB connected successfully");
    } catch (err) {
      throw new Error(`Failed to connect to MongoDB: ${err.message}`);
    }
  }
};

export async function GET(req) {
  try {
    await connectToMongo();
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Handle cases where timestamp might be missing in older documents
    const count = await Deposit.countDocuments({
      walletAddress,
      $or: [
        { timestamp: { $gte: startOfDay } },
        { timestamp: { $exists: false }, createdAt: { $gte: startOfDay } }, // Fallback for older documents
      ],
    });

    console.log(`Deposit count for ${walletAddress} today: ${count}`);
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching deposit count:", {
      message: error.message,
      stack: error.stack,
      walletAddress: req.url.split("walletAddress=")[1] || "unknown",
    });
    return NextResponse.json(
      { error: "Failed to fetch deposit count", details: error.message },
      { status: 500 }
    );
  }
}