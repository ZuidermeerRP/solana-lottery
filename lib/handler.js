// lib/handler.js
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const connectToMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    console.log("Connecting to MongoDB...");
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("MongoDB connected");
    } catch (error) {
      console.error("MongoDB connection error:", error);
      throw error;
    }
  }
};

export const createHandler = (handler) => {
  return async (req) => {
    try {
      await connectToMongo();
      const result = await handler(req);
      return NextResponse.json(result || {});
    } catch (error) {
      console.error("API Handler Error:", error.stack);
      return NextResponse.json(
        { error: "Internal Server Error", details: error.message },
        { status: 500 }
      );
    }
  };
};