// app/api/check-vip/route.js
import { NextResponse } from "next/server";
import Vip from "../../../models/Vip";
import mongoose from "mongoose";

const connectToMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
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

    const vipDoc = await Vip.findOne({ walletAddress });
    const isVip = vipDoc && vipDoc.expiresAt > new Date();

    return NextResponse.json({ isVip });
  } catch (error) {
    console.error("Error checking VIP status:", error);
    return NextResponse.json({ error: "Failed to check VIP status" }, { status: 500 });
  }
}