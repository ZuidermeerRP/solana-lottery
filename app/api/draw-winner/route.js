import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import Deposit from "../../../models/Deposit";
import Winner from "../../../models/Winner";

const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  "confirmed"
);
const LOTTERY_WALLET = process.env.LOTTERY_WALLET_PRIVATE_KEY
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.LOTTERY_WALLET_PRIVATE_KEY)))
  : null;

export async function POST(request) {
  console.log('Handler called'); // Debug: confirm handler runs
  try {
    if (!LOTTERY_WALLET) {
      throw new Error("Lottery wallet not configured");
    }

    const deposits = await Deposit.find();
    const participants = deposits.map(deposit => deposit.walletAddress);
    if (participants.length === 0) {
      return new Response(JSON.stringify({ message: "No participants" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const totalPot = deposits.reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
    if (totalPot <= 0) {
      return new Response(JSON.stringify({ message: "No pot to distribute" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const winnerIndex = Math.floor(Math.random() * participants.length);
    const winnerAddress = participants[winnerIndex];
    const potLamports = Math.floor(totalPot * 1e9);

    const balance = await connection.getBalance(LOTTERY_WALLET.publicKey);
    console.log('Wallet balance:', balance, 'Need:', potLamports + 5000); // Debug balance
    if (balance < potLamports + 5000) {
      throw new Error(`Insufficient balance: ${balance} lamports, need ${potLamports + 5000}`);
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

    await connection.confirmTransaction(signature, "confirmed");

    const winner = new Winner({ walletAddress: winnerAddress, amount: totalPot, payoutSignature: signature });
    await winner.save();
    await Deposit.deleteMany({});

    return new Response(JSON.stringify({ message: "Winner drawn and paid", signature }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error during lottery draw:", error.stack);
    return new Response(JSON.stringify({ error: "Failed to draw winner", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}