// app/page.tsx
"use client";

// Declare the solana property on the Window interface
declare global {
  interface Window {
    solana?: {
      signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      isPhantom?: boolean; // Optional, for wallet detection
    };
  }
}

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import { Transaction, PublicKey } from "@solana/web3.js";

export default function Home() {
  const {
    walletAddress,
    currentDateTime,
    connectToPhantom,
    handleDeposit,
    fetchLotteryData,
    lotteryPot,
    participants,
    error,
    getConnection,
  } = usePhantomWallet();

  const [depositSuccess, setDepositSuccess] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isHowItWorksModalOpen, setIsHowItWorksModalOpen] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isPurchasingVip, setIsPurchasingVip] = useState(false);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [latestWinner, setLatestWinner] = useState<{
    winner: string;
    amount: number;
    drawnAt: string;
    payoutSignature?: string;
  } | null>(null);
  const [showPopup, setShowPopup] = useState<"tx" | "winner" | "payout" | "vip" | null>(null);
  const [terms, setTerms] = useState<{ lastUpdated: string; content: { title: string; text: string }[] } | null>(null);
  const [howItWorks, setHowItWorks] = useState<{ lastUpdated: string; content: { title: string; text: string }[] } | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [depositCount, setDepositCount] = useState(0);
  const [visitorCount, setVisitorCount] = useState(0);
  const [isLoadingVisitorCount, setIsLoadingVisitorCount] = useState(true);

  const connection = getConnection();

  const checkVipStatus = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/check-vip?walletAddress=${walletAddress}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check VIP status");
      const { isVip } = await res.json();
      setIsVip(isVip);
    } catch (err) {
      console.error("Error checking VIP status:", err);
    }
  }, [walletAddress]);

  const fetchDepositCount = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/deposit-count?walletAddress=${walletAddress}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deposit count");
      const { count } = await res.json();
      console.log("Fetched deposit count:", count);
      setDepositCount(count);
    } catch (err) {
      console.error("Error fetching deposit count:", err);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchLotteryData();
    fetchLatestWinner();
    if (walletAddress) {
      checkVipStatus();
      fetchDepositCount();
    }
  }, [fetchLotteryData, walletAddress, checkVipStatus, fetchDepositCount]);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await fetch("/api/terms", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch terms");
        const data = await res.json();
        setTerms(data);
      } catch (err) {
        console.error("Error fetching terms:", err);
      }
    };

    const fetchHowItWorks = async () => {
      try {
        const res = await fetch("/api/how-it-works", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch how it works");
        const data = await res.json();
        setHowItWorks(data);
      } catch (err) {
        console.error("Error fetching how it works:", err);
      }
    };

const fetchVisitorCount = async () => {
  try {
    setIsLoadingVisitorCount(true);
    const res = await fetch("/api/visitor-count", { credentials: "include" }); // Corrected URL
    if (!res.ok) throw new Error("Failed to fetch visitor count");
    const data = await res.json();
    setVisitorCount(data.count);
  } catch (err) {
    console.error("Error fetching visitor count:", err);
    setVisitorCount(0);
  } finally {
    setIsLoadingVisitorCount(false);
  }
};

    fetchTerms();
    fetchHowItWorks();
    fetchVisitorCount();
  }, []);

  const fetchLatestWinner = async () => {
    try {
      const res = await fetch("/api/latest-winner", { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch latest winner: ${res.status} - ${text}`);
      }
      const data = await res.json();
      setLatestWinner(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error fetching latest winner:", errorMessage);
    }
  };

  const onDeposit = async () => {
    if (!isVip && depositCount >= 3) {
      alert("You have reached the 3-deposit limit. Upgrade to VIP for unlimited deposits!");
      return;
    }
    setIsDepositing(true);
    setDepositSuccess(false);
    setTransactionSignature(null);

    try {
      const result = await handleDeposit();
      if (result) {
        setTransactionSignature(result);
        setDepositSuccess(true);
        await fetchLotteryData();
        await fetchDepositCount();
      }
    } catch (err) {
      console.error("Deposit failed:", err);
    } finally {
      setIsDepositing(false);
    }
  };

  const onBecomeVip = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    setIsPurchasingVip(true);
    try {
      const LAMPORTS_PER_SOL = 1000000000;
      const VIP_LAMPORTS = 0.01 * LAMPORTS_PER_SOL;

      const balance = await connection.getBalance(new PublicKey(walletAddress));
      if (balance < VIP_LAMPORTS) {
        throw new Error(
          `Insufficient SOL balance. Need ${VIP_LAMPORTS / LAMPORTS_PER_SOL} SOL, have ${balance / LAMPORTS_PER_SOL} SOL`
        );
      }

      const csrfRes = await fetch("/api/csrf-token", { credentials: "include" });
      const { csrfToken } = await csrfRes.json();

      const prepareRes = await fetch("/api/prepare-vip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ walletAddress }),
        credentials: "include",
      });

      if (!prepareRes.ok) {
        const text = await prepareRes.text();
        console.error("Prepare VIP response:", { status: prepareRes.status, text });
        throw new Error(`Failed to prepare VIP payment: ${prepareRes.status} - ${text}`);
      }

      const { nonce, serializedTx } = await prepareRes.json();
      console.log("Prepared VIP serializedTx:", serializedTx);

      const transaction = Transaction.from(Buffer.from(serializedTx, "base64"));
      let signature;
      try {
        const signResult = await window.solana!.signAndSendTransaction(transaction);
        signature = signResult.signature;
        console.log("VIP transaction signature:", signature);
      } catch (signErr) {
        if (signErr instanceof Error && signErr.message.includes("insufficient funds")) {
          throw new Error("Insufficient SOL balance during signing. Please ensure you have at least 0.01 SOL.");
        }
        throw signErr;
      }

      await connection.confirmTransaction(signature, "confirmed");

      const submitRes = await fetch("/api/submit-vip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ walletAddress, signature, nonce }),
        credentials: "include",
      });

      if (!submitRes.ok) {
        const { error } = await submitRes.json();
        throw new Error(error || "Failed to submit VIP payment");
      }

      setIsVip(true);
      setShowPopup("vip");
      setTimeout(() => setShowPopup(null), 2000);
    } catch (err) {
      console.error("VIP payment failed:", err);
      const userFriendlyError =
        err instanceof Error && (err.message.includes("insufficient funds") || err.message.includes("Insufficient SOL balance"))
          ? err.message
          : "Failed to become VIP. Transaction may have failed or timed out. Check your wallet and try again.";
      alert(userFriendlyError);
    } finally {
      setIsPurchasingVip(false);
    }
  };

  const openTermsModal = () => setIsTermsModalOpen(true);
  const closeTermsModal = () => setIsTermsModalOpen(false);
  const openHowItWorksModal = () => setIsHowItWorksModalOpen(true);
  const closeHowItWorksModal = () => setIsHowItWorksModalOpen(false);

  const shortenAddress = (addr: string | null | undefined) => {
    if (!addr || typeof addr !== "string") return "";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const copyTxToClipboard = () => {
    if (transactionSignature) {
      navigator.clipboard.writeText(transactionSignature);
      setShowPopup("tx");
      setTimeout(() => setShowPopup(null), 2000);
    }
  };

  const copyWinnerToClipboard = () => {
    if (latestWinner?.winner) {
      navigator.clipboard.writeText(latestWinner.winner);
      setShowPopup("winner");
      setTimeout(() => setShowPopup(null), 2000);
    }
  };

  const copyPayoutSignatureToClipboard = () => {
    if (latestWinner?.payoutSignature) {
      navigator.clipboard.writeText(latestWinner.payoutSignature);
      setShowPopup("payout");
      setTimeout(() => setShowPopup(null), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full text-center text-lg text-gray-300 mb-4 fixed top-0 left-0 z-50 glow-bottom-border">
        <div className="marquee">
          <div className="marquee__inner">
            <span className="separator-dot">•</span>
            <span className="font-bold">🎉 Welcome to the Solana Lottery! 🎉</span>
            <span className="separator-dot">•</span>
            <span className="font-bold">
              🙋 You are visitor number {isLoadingVisitorCount ? "..." : visitorCount.toLocaleString()} 🙋
            </span>
            <span className="separator-dot">•</span>
            <span className="font-bold">🌟 Take your chance to win BIG! 🌟</span>
            <span className="separator-dot">•</span>
            <span className="font-bold">🙊 Feeling lucky? Join our thrilling lottery draws! 🙊</span>
            <span className="separator-dot">•</span>
            <span className="font-bold">👋 Uncover amazing offers and rewards! 👋</span>
            <span className="separator-dot">•</span>
            <span className="font-bold">🚀 Small deposit, win BIG! 🚀</span>
            <span className="separator-dot">•</span>
            <span className="font-bold">🎲 May luck be on your side! 🎲</span>
            <span className="separator-dot">•</span>
          </div>
        </div>
      </div>

      <div className="mb-2 mt-5">
        <Image
          src="/logo.png"
          alt="Solana Lottery Logo"
          width={600}
          height={500}
          className="object-contain w-auto h-auto"
          priority
        />
      </div>

      <h1 className="text-center text-6xl font-extrabold text-white mt-1 glow">Solana Lottery</h1>

      <div className="bg-gray-800 shadow-lg rounded-lg p-10 max-w-lg w-full mt-10 glow-border relative">
        <main className="flex flex-col items-center">
          <div className="text-center text-gray-300 mb-3">
            <span className="text-2xl block mb-6">
              🎉 <span className="font-bold">Daily Lottery</span> 🎉
            </span>
            ⏰ Draw between: <span className="font-bold text-green-200">21:00-22:00 (CET)</span> ⏰
          </div>

          <p className="text-lg text-center text-gray-300 mb-4">
            Current Lottery Pot: <span className="font-bold text-green-200">{lotteryPot} $SOL</span>🫰
          </p>

          <p className="text-lg text-center text-gray-300 mb-4">
            Deposit <span className="font-bold text-green-200">0.02 $SOL</span> to enter!
          </p>

          {latestWinner?.winner && (
            <p className="text-sm text-center text-gray-300 mb-4 relative">
              Latest Winner:{" "}
              <span
                onClick={() => copyToClipboard(latestWinner.winner, "winner")}
                className="font-bold text-green-200 cursor-pointer hover:underline"
              >
                {shortenAddress(latestWinner.winner)}
              </span>{" "}
              won <span className="font-bold text-green-200">{latestWinner.amount} $SOL</span> on{" "}
              <span className="font-bold text-green-200">
                {new Date(latestWinner.drawnAt).toLocaleDateString("en-NL", { timeZone: "Europe/Amsterdam" })}
              </span>
              {latestWinner.payoutSignature && (
                <span
                  onClick={() => copyToClipboard(latestWinner.payoutSignature ?? "", "payout")}
                  className="text-xs text-gray-500 cursor-pointer hover:underline"
                >
                  {" (Tx: "}
                  {shortenAddress(latestWinner.payoutSignature)}
                  {")"}
                </span>
              )}
              {showPopup === "winner" && (
                <span className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  Copied!
                </span>
              )}
              {showPopup === "payout" && (
                <span className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  Copied Tx!
                </span>
              )}
            </p>
          )}

          <button
            onClick={connectToPhantom}
            disabled={!!walletAddress}
            className={`glow-on-hover rounded-full border border-transparent transition-colors flex items-center justify-center mb-4 ${
              walletAddress ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {walletAddress ? "🎉 WALLET CONNECTED 🎉" : "Connect Phantom Wallet"}
          </button>

          {walletAddress && (
            <button
              onClick={onDeposit}
              disabled={isDepositing}
              className={`glow-on-hover rounded-full border border-transparent transition-colors flex items-center justify-center mb-4 ${
                isDepositing ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isDepositing ? "Depositing..." : "Deposit 0.01 $SOL (+0.005 fee)"}
            </button>
          )}

          {walletAddress && (
            <p className="text-sm text-center text-gray-400 mb-4">
              <span className="font-bold text-white">Connected Wallet:</span>{" "}
              <span className="font-bold text-green-200">{shortenAddress(walletAddress)}</span>
            </p>
          )}

          {walletAddress && (
            <p className="text-sm text-center text-gray-400 mb-4">
              <span className="font-bold text-white">Total Entries:</span>{" "}
              <span className="font-bold text-green-200">{participants.length}</span>
            </p>
          )}

          {walletAddress && (
            <p className="text-sm text-center text-gray-400 mb-4">
              <span className="font-bold text-white">Deposits Today:</span>{" "}
              <span className="font-bold text-green-200">{isVip ? "Unlimited (VIP)" : `${depositCount}/3`}</span>
            </p>
          )}

          {isDepositing && (
            <p className="text-sm text-center text-yellow-400 mb-4">
              ⏳ Depositing, please wait...{" "}
              <span className="inline-block w-4 h-4 border-2 border-t-transparent border-yellow-400 rounded-full animate-spin"></span>
            </p>
          )}

          {isPurchasingVip && (
            <p className="text-sm text-center text-yellow-400 mb-4">
              ⏳ Purchasing VIP, please wait...{" "}
              <span className="inline-block w-4 h-4 border-2 border-t-transparent border-yellow-400 rounded-full animate-spin"></span>
            </p>
          )}

          {depositSuccess && (
            <p className="text-sm text-center text-green-400 mb-4 relative">
              🎉 Deposit successful! Thank you for participating! 🎉{" "}
              {transactionSignature && (
                <span
                  onClick={copyTxToClipboard}
                  className="text-xs text-gray-500 cursor-pointer hover:underline"
                >
                  (Tx: {shortenAddress(transactionSignature)})
                </span>
              )}
              {showPopup === "tx" && (
                <span className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  Copied!
                </span>
              )}
            </p>
          )}

          {showPopup === "vip" && (
            <p className="text-sm text-center text-yellow-400 mb-4 relative">
              🎖️ VIP status activated! Enjoy unlimited deposits for 24 hours! 🎖️
            </p>
          )}

          {error && <p className="text-sm text-center text-red-400 mb-4">❌ {error} ❌</p>}

<p className="text-sm text-center text-gray-300">
  Today&apos;s date is <span className="font-bold text-green-200">{currentDateTime}</span> in CET.
</p>
        </main>
      </div>

      <div className="flex space-x-2 mt-5">
        <span
          onClick={openTermsModal}
          className="cursor-pointer text-white font-bold hover:underline transition-colors glow"
        >
          Terms of Use
        </span>
        <span
          onClick={openHowItWorksModal}
          className="cursor-pointer text-white font-bold hover:underline transition-colors glow"
        >
          How It Works
        </span>
        {walletAddress && (
          <span
            onClick={!isVip && !isPurchasingVip ? onBecomeVip : undefined}
            className={`cursor-pointer text-white font-bold hover:underline transition-colors ${
              isVip || isPurchasingVip ? "gold-glow opacity-50 cursor-not-allowed" : "gold-glow"
            }`}
          >
            {isVip ? "VIP Active" : isPurchasingVip ? "Purchasing VIP..." : "Become VIP (0.01 $SOL)"}
          </span>
        )}
      </div>

      {isTermsModalOpen && terms && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-15 mt-4">
          <div className="bg-gray-800 shadow-lg rounded-lg p-8 max-w-xl w-full max-h-[80vh] overflow-y-auto relative">
            <h1 className="text-center text-2xl font-extrabold text-white mb-4 mt-2">Terms of Use</h1>
            <p className="text-gray-300 mb-2">
              Last Updated: <span className="font-bold text-green-200">{terms.lastUpdated}</span>
            </p>
            <ol className="list-decimal list-inside text-gray-300 mb-12">
              {terms.content.map((term, index) => (
                <li key={index} className="mb-2">
                  <strong>
                    <span className="font-bold text-green-200">{term.title}:</span>
                  </strong>
                  <br />
                  {term.text}
                </li>
              ))}
            </ol>
            <button
              onClick={closeTermsModal}
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 rounded-full border border-white bg-white text-gray-800 px-4 py-2 text-sm hover:bg-gray-200 transition duration-200 ease-in-out"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isHowItWorksModalOpen && howItWorks && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-15 mt-4">
          <div className="bg-gray-800 shadow-lg rounded-lg p-8 max-w-xl w-full max-h-[80vh] overflow-y-auto relative">
            <h1 className="text-center text-2xl font-extrabold text-white mb-4 mt-2">How It Works</h1>
            <p className="text-gray-300 mb-2">
              Last Updated: <span className="font-bold text-green-200">{howItWorks.lastUpdated}</span>
            </p>
            <ol className="list-decimal list-inside text-gray-300 mb-12">
              {howItWorks.content.map((item, index) => (
                <li key={index} className="mb-2">
                  <strong>
                    <span className="font-bold text-green-200">{item.title}:</span>
                  </strong>
                  <br />
                  {item.text}
                </li>
              ))}
            </ol>
            <button
              onClick={closeHowItWorksModal}
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 rounded-full border border-white bg-white text-gray-800 px-4 py-2 text-sm hover:bg-gray-200 transition duration-200 ease-in-out"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}