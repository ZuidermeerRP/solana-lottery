// app/api/draw-winner/route.js
import { createHandler } from "../../../lib/handler";
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import Deposit from "../../../models/Deposit";
import Winner from "../../../models/Winner";

const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  "confirmed"
);
const LOTTERY_WALLET_PRIVATE_KEY = process.env.LOTTERY_WALLET_PRIVATE_KEY
  ? JSON.parse(process.env.LOTTERY_WALLET_PRIVATE_KEY)
  : null;
const LOTTERY_WALLET = LOTTERY_WALLET_PRIVATE_KEY ? Keypair.fromSecretKey(Uint8Array.from(LOTTERY_WALLET_PRIVATE_KEY)) : null;

export const POST = createHandler(async (req, res) => {
  try {
    const deposits = await Deposit.find();
    const participants = deposits.map(deposit => deposit.walletAddress);

    if (participants.length === 0) {
      return res.status(200).json({ message: "No participants" });
    }

    const totalPot = deposits.reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
    if (totalPot <= 0) {
      return res.status(200).json({ message: "No pot to distribute" });
    }

    const winnerIndex = Math.floor(Math.random() * participants.length);
    const winnerAddress = participants[winnerIndex];

    if (!LOTTERY_WALLET) {
      return res.status(500).json({ error: "Lottery wallet not configured" });
    }

    try {
      new PublicKey(winnerAddress);
    } catch { // Removed 'e'
      return res.status(400).json({ error: "Invalid winner address" });
    }

    const potLamports = Math.floor(totalPot * 1e9);

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

    await connection.confirmTransaction(signature, "confirmed");

    const winner = new Winner({
      walletAddress: winnerAddress,
      amount: totalPot,
      payoutSignature: signature,
    });
    await winner.save();

    await Deposit.deleteMany({});

    res.status(200).json({ message: "Winner drawn and paid", signature });
  } catch (error) {
    console.error("Error during lottery draw:", error.stack);
    res.status(500).json({ error: "Failed to draw winner", details: error.message });
  }
});