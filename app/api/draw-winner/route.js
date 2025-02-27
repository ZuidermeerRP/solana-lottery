import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import mongoose from "mongoose"; // Assuming Mongoose for DB
import Deposit from "../../../models/Deposit"; // Adjust path as needed
import Winner from "../../../models/Winner"; // Adjust path as needed

// Initialize Solana connection
const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// Load lottery wallet from environment variable
const LOTTERY_WALLET = process.env.LOTTERY_WALLET_PRIVATE_KEY
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.LOTTERY_WALLET_PRIVATE_KEY)))
  : null;

// Connect to MongoDB (reuse connection if already open)
const connectDB = async () => {
  if (mongoose.connections[0].readyState) {
    console.log("Reusing existing DB connection");
    return;
  }
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("DB connected");
};

// POST handler for /api/draw-winner
export async function POST() {
  console.log("POST /api/draw-winner invoked");

  try {
    // Connect to database
    await connectDB();

    // Validate lottery wallet
    if (!LOTTERY_WALLET) {
      throw new Error("Lottery wallet not configured in environment variables");
    }
    console.log("Lottery wallet:", LOTTERY_WALLET.publicKey.toString());

    // Fetch participants
    const deposits = await Deposit.find();
    const participants = deposits.map((deposit) => deposit.walletAddress);
    console.log("Participants:", participants.length);

    if (participants.length === 0) {
      return new Response(JSON.stringify({ message: "No participants found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate total pot
    const totalPot = deposits.reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
    console.log("Total pot (SOL):", totalPot);
    if (totalPot <= 0) {
      return new Response(JSON.stringify({ message: "No pot to distribute" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Select winner
    const winnerIndex = Math.floor(Math.random() * participants.length);
    const winnerAddress = participants[winnerIndex];
    const potLamports = Math.floor(totalPot * 1e9); // Convert SOL to lamports
    console.log("Winner selected:", winnerAddress);

    // Check wallet balance
    const balance = await connection.getBalance(LOTTERY_WALLET.publicKey);
    const requiredLamports = potLamports + 5000; // Pot + tx fee
    console.log("Wallet balance (lamports):", balance, "Required:", requiredLamports);
    if (balance < requiredLamports) {
      throw new Error(`Insufficient balance: ${balance} lamports, need ${requiredLamports}`);
    }

    // Build and send transaction
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
      skipPreflight: false, // Keep preflight for reliability
      preflightCommitment: "confirmed",
    });
    console.log("Transaction sent, signature:", signature);

    await connection.confirmTransaction(signature, "confirmed");
    console.log("Transaction confirmed");

    // Save winner and clear deposits
    const winner = new Winner({
      walletAddress: winnerAddress,
      amount: totalPot,
      payoutSignature: signature,
    });
    await winner.save();
    console.log("Winner saved to DB");

    await Deposit.deleteMany({});
    console.log("Deposits cleared");

    return new Response(
      JSON.stringify({ message: "Winner drawn and paid", signature }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in lottery draw:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: "Failed to draw winner", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Handle GET requests (for debugging or to prevent 405 errors)
export async function GET() {
  console.log("GET /api/draw-winner invoked (not allowed)");
  return new Response(
    JSON.stringify({ error: "Method not allowed, use POST to draw a winner" }),
    {
      status: 405,
      headers: { "Content-Type": "application/json" },
    }
  );
}