import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import mongoose from "mongoose";
import Deposit from "../../../models/Deposit"; // Adjust path
import Winner from "../../../models/Winner"; // Adjust path

const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  "confirmed"
);

const LOTTERY_WALLET = process.env.LOTTERY_WALLET_PRIVATE_KEY
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.LOTTERY_WALLET_PRIVATE_KEY)))
  : null;

const connectDB = async () => {
  if (mongoose.connection.readyState) {
    console.log("Reusing existing DB connection");
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB connected to:", mongoose.connection.name);
  } catch (error) {
    console.error("DB connection failed:", error.message);
    throw error;
  }
};

const drawWinner = async () => {
  console.log("Starting draw-winner process");
  try {
    await connectDB();

    if (!LOTTERY_WALLET) {
      throw new Error("LOTTERY_WALLET_PRIVATE_KEY is not set or invalid");
    }
    console.log("Lottery wallet public key:", LOTTERY_WALLET.publicKey.toString());

    const deposits = await Deposit.find().lean();
    const participants = deposits.map((deposit) => deposit.walletAddress);
    console.log("Total participants:", participants.length);
    if (!participants.length) {
      return { message: "No participants found", status: 200 };
    }

    const totalPot = deposits.reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
    console.log("Total pot (SOL):", totalPot);
    if (totalPot <= 0) {
      return { message: "No pot to distribute", status: 200 };
    }

    const winnerIndex = Math.floor(Math.random() * participants.length);
    const winnerAddress = participants[winnerIndex];
    const potLamports = Math.floor(totalPot * 1e9);
    console.log("Selected winner:", winnerAddress);

    const balance = await connection.getBalance(LOTTERY_WALLET.publicKey);
    const requiredLamports = potLamports + 5000;
    console.log("Wallet balance (lamports):", balance, "Required:", requiredLamports);
    if (balance < requiredLamports) {
      throw new Error(`Insufficient balance: ${balance} lamports, need ${requiredLamports}`);
    }

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: LOTTERY_WALLET.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: LOTTERY_WALLET.publicKey,
        toPubkey: new PublicKey(winnerAddress),
        lamports: potLamports,
      })
    );

    const signature = await connection.sendTransaction(transaction, [LOTTERY_WALLET], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    console.log("Transaction sent, signature:", signature);

    // Add timeout and better error handling for confirmation
    console.log("Attempting to confirm transaction...");
    try {
      await Promise.race([
        connection.confirmTransaction(signature, "confirmed"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Transaction confirmation timeout")), 15000) // 15s timeout
        ),
      ]);
      console.log("Transaction confirmed");
    } catch (confirmError) {
      console.error("Confirmation failed:", confirmError.message);
      throw new Error(`Transaction confirmation failed: ${confirmError.message}`);
    }

    const winner = new Winner({
      walletAddress: winnerAddress,
      amount: totalPot,
      payoutSignature: signature,
    });
    await winner.save();
    console.log("Winner saved to DB");

    const deleteResult = await Deposit.deleteMany({});
    console.log("Deposits deleted, count:", deleteResult.deletedCount);
    const remainingDeposits = await Deposit.countDocuments();
    console.log("Remaining deposits after deletion:", remainingDeposits);
    if (remainingDeposits > 0) {
      throw new Error("Failed to clear all deposits");
    }

    return { message: "Winner drawn, paid, and deposits cleared", signature, status: 200 };
  } catch (error) {
    console.error("Draw winner error:", error.message, error.stack);
    return { error: "Failed to process draw", details: error.message, status: 500 };
  }
};

export async function GET() {
  const result = await drawWinner();
  return new Response(
    JSON.stringify(
      result.error
        ? { error: result.error, details: result.details }
        : { message: result.message, signature: result.signature }
    ),
    {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function POST() {
  const result = await drawWinner();
  return new Response(
    JSON.stringify(
      result.error
        ? { error: result.error, details: result.details }
        : { message: result.message, signature: result.signature }
    ),
    {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    }
  );
}