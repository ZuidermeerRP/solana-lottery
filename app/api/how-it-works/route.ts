// app/api/how-it-works/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const howItWorks = {
    lastUpdated: "28-02-2025",
    content: [
      {
        title: "Getting Started with Phantom Wallet",
        text: "To join the Solana Lottery, connect your Phantom Wallet—a widely used Solana-compatible wallet. Click 'Connect Phantom Wallet' on the main page and follow the prompts to link your wallet securely.",
      },
      {
        title: "Depositing 0.02 $SOL",
        text: "Each lottery entry requires a deposit of 0.02 $SOL, plus a 0.001 $SOL transaction fee. After connecting your wallet, click 'Deposit 0.02 $SOL (+0.005 fee)' to enter. You’re limited to 3 deposits per day unless you upgrade to VIP.",
      },
      {
        title: "Daily Draw (21:00 - 22:00 CET)",
        text: "A winner is randomly selected every day between 21:00 and 22:00 CET from all participants. The draw is fair and based on the number of entries you’ve submitted.",
      },
      {
        title: "Traceability",
        text: "All deposits and draw results are recorded on the Solana blockchain, ensuring transparency. You can trace every transaction and verify winners using your transaction signature or blockchain explorers.",
      },
      {
        title: "Winning the Pot",
        text: "The more you deposit, the higher your chances of winning the entire pot. For example, depositing 0.01 $SOL three times gives you 3 entries, tripling your odds compared to a single entry. The pot goes to one lucky winner daily!",
      },
      {
        title: "VIP 24 HOURS",
        text: "Upgrade to VIP status to unlock unlimited deposits for 24 hours. Without VIP, you’re capped at 3 deposits per day. With VIP, you can deposit as many times as you like within that period, massively boosting your chances to win the pot!",
      },
    ],
  };

  return NextResponse.json(howItWorks);
}