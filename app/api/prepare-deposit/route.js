// app/api/prepare-deposit/route.js
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
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
const TOTAL_LAMPORTS = (0.02 + 0.001) * 1e9; // This will give you 24,000,000 lamports

export async function POST(req) {
  try {
    await connectToMongo();

    const { walletAddress } = await req.json();
    const csrfTokenHeader = req.headers.get("x-csrf-token");

    console.log("Client CSRF Token (prepare-deposit):", csrfTokenHeader);

    if (!csrfTokenHeader) {
      return NextResponse.json({ error: "CSRF token missing" }, { status: 403 });
    }

    const csrfNonceDoc = await Nonce.findOne({
      walletAddress: "csrf-token",
      nonce: csrfTokenHeader,
    });

    if (!csrfNonceDoc || csrfNonceDoc.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired CSRF token" }, { status: 403 });
    }

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "walletAddress is required and must be a string" },
        { status: 400 }
      );
    }

    const nonce = Math.random().toString(36).substring(2);
    await new Nonce({ walletAddress, nonce }).save();

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: new PublicKey(walletAddress),
    }).add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(walletAddress),
        toPubkey: new PublicKey(LOTTERY_WALLET_PUBLIC_KEY),
        lamports: TOTAL_LAMPORTS,
      })
    );

    const serializedTx = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    const responseBody = { nonce, serializedTx };
    console.log("Prepared deposit:", { lamports: TOTAL_LAMPORTS, serializedTx });

    return NextResponse.json(responseBody, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in prepare-deposit:", error.stack);
    return NextResponse.json(
      { error: "Failed to prepare deposit", details: error.message },
      { status: 500 }
    );
  }
}