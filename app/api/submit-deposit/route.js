// app/api/submit-deposit/route.js
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import Deposit from "../../../models/Deposit";
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
const LOTTERY_AMOUNT = 0.01;
const TOTAL_LAMPORTS = (LOTTERY_AMOUNT + 0.005) * 1e9;

export async function POST(req) {
  try {
    await connectToMongo();

    const { walletAddress, signature, nonce } = await req.json();
    const csrfTokenHeader = req.headers.get("x-csrf-token");

    console.log("Client CSRF Token (submit-deposit):", csrfTokenHeader);

    if (!csrfTokenHeader) {
      return NextResponse.json(
        { error: "CSRF token missing" },
        { status: 403 }
      );
    }

    // Validate CSRF token and delete it
    const csrfNonceDoc = await Nonce.findOneAndDelete({
      walletAddress: "csrf-token",
      nonce: csrfTokenHeader,
    });

    if (!csrfNonceDoc || csrfNonceDoc.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired CSRF token" },
        { status: 403 }
      );
    }

    if (!walletAddress || !signature || !nonce) {
      return NextResponse.json(
        { error: "walletAddress, signature, and nonce are required" },
        { status: 400 }
      );
    }

    const nonceDoc = await Nonce.findOneAndDelete({ walletAddress, nonce });
    if (!nonceDoc) {
      return NextResponse.json(
        { error: "Invalid or expired nonce" },
        { status: 400 }
      );
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
    if (lamports !== TOTAL_LAMPORTS || destination !== LOTTERY_WALLET_PUBLIC_KEY) {
      return NextResponse.json(
        {
          error: "Invalid deposit amount or destination",
          details: { lamports, expected: TOTAL_LAMPORTS, destination, expected: LOTTERY_WALLET_PUBLIC_KEY },
        },
        { status: 400 }
      );
    }

    const deposit = new Deposit({
      walletAddress,
      amount: LOTTERY_AMOUNT,
      signature,
      nonce,
    });
    await deposit.save();

    const responseBody = { message: "Deposit verified and saved" };
    console.log("Response body prepared:", responseBody);

    return NextResponse.json(responseBody, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in submit-deposit:", error.stack);
    return NextResponse.json(
      { error: "Failed to process deposit", details: error.message },
      { status: 500 }
    );
  }
}