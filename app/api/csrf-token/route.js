import { NextResponse } from "next/server";
import Nonce from "../../../models/Nonce";
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

export async function GET() {
  try {
    await connectToMongo();
    const csrfToken = Math.random().toString(36).substring(2);
    const nonceDoc = new Nonce({
      walletAddress: "csrf-token",
      nonce: csrfToken,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    await nonceDoc.save();
    console.log("Generated CSRF Token:", csrfToken);
    return NextResponse.json({ csrfToken }, { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in csrf-token:", error.stack);
    return NextResponse.json({ error: "Failed to generate CSRF token", details: error.message }, { status: 500 });
  }
}