// app/page.tsx
"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { usePhantomWallet } from "../hooks/usePhantomWallet";

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
  } = usePhantomWallet();

  const [depositSuccess, setDepositSuccess] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [latestWinner, setLatestWinner] = useState<{ winner: string; amount: number; drawnAt: string } | null>(null);
  const [showPopup, setShowPopup] = useState<"tx" | "winner" | null>(null);
  const [terms, setTerms] = useState<{ lastUpdated: string; content: { title: string; text: string }[] } | null>(null);

  useEffect(() => {
    fetchLotteryData();
    fetchLatestWinner();
  }, [fetchLotteryData]);

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
    fetchTerms();
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error fetching latest winner:", errorMessage);
    }
  };

  const onDeposit = async () => {
    setIsDepositing(true);
    setDepositSuccess(false);
    setTransactionSignature(null);

    try {
      const result = await handleDeposit();
      if (result) {
        setTransactionSignature(result);
        setDepositSuccess(true);
        await fetchLotteryData();
      }
    } catch (err) {
      console.error("Deposit failed:", err);
    } finally {
      setIsDepositing(false);
    }
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full text-center text-lg text-gray-300 mb-4 fixed top-0 left-0 z-50 glow-bottom-border">
        <div className="marquee">
          <div className="marquee__inner">
            <span className="separator-dot">•</span>
            <span className="font-bold">🎉 Welcome to the Solana Lottery! 🎉</span>
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
        />
      </div>

      <h1 className="text-center text-6xl font-extrabold text-white mt-1 glow">Solana Lottery</h1>

      <div className="bg-gray-800 shadow-lg rounded-lg p-10 max-w-lg w-full mt-10 glow-border relative">
        <main className="flex flex-col items-center">
          <p className="text-xl text-center text-gray-300 mb-3">
            🎉 Daily Lottery 🎉
            <br />
            🎉 Draw between 21:00-22:00 (CET)! 🎉
          </p>
          <p className="text-lg text-center text-gray-300 mb-4">
            Current Lottery Pot: <span className="font-bold text-green-200">{lotteryPot} $SOL</span>
          </p>
          <p className="text-lg text-center text-gray-300 mb-4">
            Deposit <span className="font-bold text-green-200">0.01 $SOL</span> to enter!
          </p>

          {latestWinner && latestWinner.winner && (
            <p className="text-sm text-center text-gray-300 mb-4 relative">
              Latest Winner:{" "}
              <span
                onClick={copyWinnerToClipboard}
                className="font-bold text-green-200 cursor-pointer hover:underline"
              >
                {shortenAddress(latestWinner.winner)}
              </span>{" "}
              won <span className="font-bold text-green-200">{latestWinner.amount} $SOL</span> on{" "}
              <span className="font-bold text-green-200">
                {new Date(latestWinner.drawnAt).toLocaleDateString("en-NL", { timeZone: "Europe/Amsterdam" })}
              </span>
              {showPopup === "winner" && (
                <span className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  Copied!
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
              <span className="font-bold text-green-200">{walletAddress}</span>
            </p>
          )}

          {walletAddress && (
            <p className="text-sm text-center text-gray-400 mb-4">
              <span className="font-bold text-white">Total Entries:</span>{" "}
              <span className="font-bold text-green-200">{participants.length}</span>
            </p>
          )}

          {isDepositing && (
            <p className="text-sm text-center text-yellow-400 mb-4">⏳ Depositing, please wait... ⏳</p>
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

          {error && <p className="text-sm text-center text-red-400 mb-4">❌ {error} ❌</p>}

          <p className="text-sm text-center text-gray-300">
            Today&apos;s date is <span className="font-bold text-green-200">{currentDateTime}</span> in CET.
          </p>
        </main>
      </div>

      <div className="flex space-x-2 mt-5">
        <span
          onClick={openModal}
          className="cursor-pointer text-white font-bold hover:underline transition-colors glow"
        >
          Terms of Use
        </span>
      </div>

      {isModalOpen && terms && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-15 mt-4">
          <div className="bg-gray-800 shadow-lg rounded-lg p-8 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h1 className="text-center text-2xl font-extrabold text-white mb-4 mt-2">Terms of Use</h1>
            <p className="text-gray-300 mb-2">
              Last Updated: <span className="font-bold text-green-200">{terms.lastUpdated}</span>
            </p>
            <ol className="list-decimal list-inside text-gray-300">
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
              onClick={closeModal}
              className="mt-4 glow-on-hover rounded-full border border-white bg-white text-gray-800 px-2 py-1 text-xs hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}