// app/api/submit-vip/route.js
import { Connection, SystemProgram } from "@solana/web3.js";
import Vip from "../../../models/Vip";
import Nonce from "../../../models/Nonce";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const connectToMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
};

const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  "confirmed"
);
const LOTTERY_WALLET_PUBLIC_KEY = "CFLcvynnCrfQHcevyosen2yFp8qj59JPxjRww4MWPi28";
const VIP_LAMPORTS = 0.01 * 1e9;

export async function POST(req) {
  try {
    await connectToMongo();

    const { walletAddress, signature, nonce } = await req.json();
    const csrfTokenHeader = req.headers.get("x-csrf-token");

    console.log("Client CSRF Token (submit-vip):", csrfTokenHeader);

    if (!csrfTokenHeader) {
      return NextResponse.json({ error: "CSRF token missing" }, { status: 403 });
    }

    const csrfNonceDoc = await Nonce.findOneAndDelete({
      walletAddress: "csrf-token",
      nonce: csrfTokenHeader,
    });

    if (!csrfNonceDoc || csrfNonceDoc.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired CSRF token" }, { status: 403 });
    }

    if (!walletAddress || !signature || !nonce) {
      return NextResponse.json(
        { error: "walletAddress, signature, and nonce are required" },
        { status: 400 }
      );
    }

    const nonceDoc = await Nonce.findOneAndDelete({ walletAddress, nonce });
    if (!nonceDoc) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
    }

    const tx = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
      return NextResponse.json(
        { error: "Transaction not found or not confirmed" },
        { status: 400 }
      );
    }

    const instructions = tx.transaction.message.instructions;
    if (!instructions || instructions.length === 0) {
      return NextResponse.json(
        { error: "No instructions found in transaction" },
        { status: 400 }
      );
    }

    const transfer = instructions.find((instr) => {
      return (
        instr.programId.toString() === SystemProgram.programId.toString() &&
        instr.parsed?.type === "transfer"
      );
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "No valid transfer instruction found" },
        { status: 400 }
      );
    }

    const { lamports, destination } = transfer.parsed.info;
    if (lamports !== VIP_LAMPORTS || destination !== LOTTERY_WALLET_PUBLIC_KEY) {
      return NextResponse.json(
        {
          error: "Invalid VIP payment amount or destination",
          details: { lamports, expected: VIP_LAMPORTS, destination, expected: LOTTERY_WALLET_PUBLIC_KEY },
        },
        { status: 400 }
      );
    }

    // Save VIP status (24-hour expiration)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await Vip.findOneAndUpdate(
      { walletAddress },
      { activatedAt: new Date(), expiresAt },
      { upsert: true, new: true }
    );

    const responseBody = { message: "VIP status activated" };
    console.log("Response body prepared:", responseBody);

    return NextResponse.json(responseBody, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in submit-vip:", error.stack);
    return NextResponse.json(
      { error: "Failed to process VIP payment", details: error.message },
      { status: 500 }
    );
  }
}