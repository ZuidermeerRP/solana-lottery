import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import mongoose from "mongoose";
import Deposit from "../../../models/Deposit"; // Adjust path
import Winner from "../../../models/Winner"; // Adjust path

// Solana connection
const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// Lottery wallet
const LOTTERY_WALLET = process.env.LOTTERY_WALLET_PRIVATE_KEY
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.LOTTERY_WALLET_PRIVATE_KEY)))
  : null;

// MongoDB connection
const connectDB = async () => {
  if (mongoose.connections[0].readyState) {
    console.log("Reusing DB connection");
    return;
  }
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("DB connected");
};

// Core draw logic (shared between GET and POST)
const drawWinner = async () => {
  console.log("/api/draw-winner invoked");
  try {
    await connectDB();

    if (!LOTTERY_WALLET) {
      throw new Error("LOTTERY_WALLET_PRIVATE_KEY not set or invalid");
    }
    console.log("Lottery wallet:", LOTTERY_WALLET.publicKey.toString());

    const deposits = await Deposit.find();
    const participants = deposits.map((deposit) => deposit.walletAddress);
    console.log("Participants:", participants.length);
    if (participants.length === 0) {
      return { message: "No participants", status: 200 };
    }

    const totalPot = deposits.reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
    console.log("Total pot (SOL):", totalPot);
    if (totalPot <= 0) {
      return { message: "No pot to distribute", status: 200 };
    }

    const winnerIndex = Math.floor(Math.random() * participants.length);
    const winnerAddress = participants[winnerIndex];
    const potLamports = Math.floor(totalPot * 1e9);
    console.log("Winner:", winnerAddress);

    const balance = await connection.getBalance(LOTTERY_WALLET.publicKey);
    const requiredLamports = potLamports + 5000;
    console.log("Balance (lamports):", balance, "Required:", requiredLamports);
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
    console.log("Transaction signature:", signature);

    await connection.confirmTransaction(signature, "confirmed");
    console.log("Transaction confirmed");

    const winner = new Winner({
      walletAddress: winnerAddress,
      amount: totalPot,
      payoutSignature: signature,
    });
    await winner.save();
    console.log("Winner saved");
    await Deposit.deleteMany({});
    console.log("Deposits cleared");

    return { message: "Winner drawn and paid", signature, status: 200 };
  } catch (error) {
    console.error("Error:", error.message, error.stack);
    return { error: "Failed to draw winner", details: error.message, status: 500 };
  }
};

// Handle GET (for cron)
export async function GET() {
  const result = await drawWinner();
  return new Response(JSON.stringify(result.error ? { error: result.error, details: result.details } : { message: result.message, signature: result.signature }), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}

// Handle POST (for manual testing)
export async function POST() {
  const result = await drawWinner();
  return new Response(JSON.stringify(result.error ? { error: result.error, details: result.details } : { message: result.message, signature: result.signature }), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}