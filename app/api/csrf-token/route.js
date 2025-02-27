// app/api/csrf-token/route.js
import { NextResponse } from "next/server";
import Nonce from "../../../models/Nonce";
import mongoose from "mongoose";

const connectToMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
};

export async function GET(req) {
  try {
    await connectToMongo();

    // Generate a random CSRF token
    const csrfToken = Math.random().toString(36).substring(2);
    
    // Store it in the Nonce model with a 5-minute TTL
    const nonceDoc = new Nonce({
      walletAddress: "csrf-token", // Dummy identifier for CSRF tokens
      nonce: csrfToken,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // Expires in 5 minutes
    });
    await nonceDoc.save();

    console.log("Generated CSRF Token:", csrfToken);
    const responseBody = { csrfToken };
    console.log("Response body prepared:", responseBody);

    return NextResponse.json(responseBody, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in csrf-token:", error.stack);
    return NextResponse.json(
      { error: "Failed to generate CSRF token", details: error.message },
      { status: 500 }
    );
  }
}