// app/api/submit-deposit/route.js
import { Connection, SystemProgram } from "@solana/web3.js";
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
const FEE_WALLET_PUBLIC_KEY = "AhYVXTS9ASNLkoUGd5u65F7uaNJSwddfTwnK7yV1YDVr";
const LOTTERY_AMOUNT = 0.02; // SOL
const FEE_AMOUNT = 0.001;    // SOL
const LOTTERY_LAMPORTS = LOTTERY_AMOUNT * 1e9; // 0.01 SOL in lamports
const FEE_LAMPORTS = FEE_AMOUNT * 1e9;         // 0.005 SOL in lamports

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

    // Find all transfer instructions
    const transfers = instructions.filter(
      (instr) =>
        instr.programId.toString() === SystemProgram.programId.toString() &&
        instr.parsed?.type === "transfer"
    );

    if (transfers.length !== 2) {
      return NextResponse.json(
        { error: "Transaction must contain exactly two transfers" },
        { status: 400 }
      );
    }

    // Validate lottery transfer
    const lotteryTransfer = transfers.find(
      (t) => t.parsed.info.destination === LOTTERY_WALLET_PUBLIC_KEY
    );
    if (!lotteryTransfer) {
      return NextResponse.json(
        { error: "No transfer to lottery wallet found" },
        { status: 400 }
      );
    }
    const { lamports: lotteryLamports } = lotteryTransfer.parsed.info;
    if (lotteryLamports !== LOTTERY_LAMPORTS) {
      return NextResponse.json(
        {
          error: "Invalid lottery deposit amount",
          details: { lamports: lotteryLamports, expected: LOTTERY_LAMPORTS },
        },
        { status: 400 }
      );
    }

    // Validate fee transfer
    const feeTransfer = transfers.find(
      (t) => t.parsed.info.destination === FEE_WALLET_PUBLIC_KEY
    );
    if (!feeTransfer) {
      return NextResponse.json(
        { error: "No transfer to fee wallet found" },
        { status: 400 }
      );
    }
    const { lamports: feeLamports } = feeTransfer.parsed.info;
    if (feeLamports !== FEE_LAMPORTS) {
      return NextResponse.json(
        {
          error: "Invalid fee amount",
          details: { lamports: feeLamports, expected: FEE_LAMPORTS },
        },
        { status: 400 }
      );
    }

    // Save deposit (only tracking lottery amount, not fee)
    const deposit = new Deposit({
      walletAddress,
      amount: LOTTERY_AMOUNT,
      signature,
      nonce,
    });
    await deposit.save();
    console.log("Deposit saved:", deposit);

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