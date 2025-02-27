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

  useEffect(() => {
    fetchLotteryData();
    fetchLatestWinner();
  }, [fetchLotteryData]);

  const fetchLatestWinner = async () => {
    try {
      const res = await fetch("/api/latest-winner", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch latest winner");
      const data = await res.json();
      setLatestWinner(data);
    } catch (err) {
      console.error("Error fetching latest winner:", err);
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

      <div className="bg-gray-800 shadow-lg rounded-lg p-8 max-w-md w-full mt-10 glow-border relative">
        <main className="flex flex-col items-center">
          <p className="text-xl text-center text-gray-300 mb-3">
            🎉 Daily Lottery Draw at <span className="font-bold text-green-400">21:00 (CET)</span>! 🎉
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

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-15 mt-4">
          <div className="bg-gray-800 shadow-lg rounded-lg p-8 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h1 className="text-center text-2xl font-extrabold text-white mb-4 mt-2">Terms of Use</h1>
            <p className="text-gray-300 mb-2">
              Last Updated: <span className="font-bold text-green-200">26-02-2025</span>
            </p>
            <ol className="list-decimal list-inside text-gray-300">
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Acceptance of Terms:</span>
                </strong>
                <br />
                By accessing or using our Solana Lottery website (&quot;Website&quot;), you agree to comply with and be
                bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you must not
                use the Website.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Eligibility:</span>
                </strong>
                <br />
                You must be at least 18 years old to use this Website. By using this Website, you represent and warrant
                that you are at least 18 years old and have the legal capacity to enter into these Terms.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">User Responsibilities:</span>
                </strong>
                <br />
                As a user of the Website, you agree to:
                <ul className="list-disc list-inside">
                  <li>Use the Website in compliance with all applicable laws and regulations.</li>
                  <li>Provide accurate and complete information when registering or participating in the lottery.</li>
                  <li>Maintain the security of your account and promptly notify us of any unauthorized use.</li>
                </ul>
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Lottery Participation:</span>
                </strong>
                <br />
                Participation in the lottery is at your own risk and responsibility. We are not responsible for any
                losses or damages incurred as a result of participating in the lottery.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">No Refund Policy:</span>
                </strong>
                <br />
                All purchases made on the Website are final and non-refundable. By participating in the lottery, you
                acknowledge and agree that you will not receive a refund for any reason.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Intellectual Property:</span>
                </strong>
                <br />
                All content on the Website, including text, graphics, logos, and software, is the property of [Your
                Company Name] and is protected by applicable intellectual property laws. You may not reproduce,
                distribute, or create derivative works from any content on the Website without our prior written
                consent.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Disclaimer of Warranties:</span>
                </strong>
                <br />
                The Website is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We make no
                representations or warranties of any kind, express or implied, regarding the operation or availability
                of the Website, or the accuracy, completeness, or reliability of any information provided on the
                Website.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Limitation of Liability:</span>
                </strong>
                <br />
                To the fullest extent permitted by applicable law, we shall not be liable for any indirect, incidental,
                special, or consequential damages arising out of or in connection with your use of the Website, even if
                we have been advised of the possibility of such damages.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Changes to the Terms:</span>
                </strong>
                <br />
                We reserve the right to modify or update these Terms at any time. Any changes will be effective
                immediately upon posting on the Website. Your continued use of the Website after the posting of changes
                constitutes your acceptance of the modified Terms.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Governing Law:</span>
                </strong>
                <br />
                These Terms shall be governed by and construed in accordance with the laws of [Your Country/State],
                without regard to its conflict of law principles.
              </li>
              <li className="mb-2">
                <strong>
                  <span className="font-bold text-green-200">Contact Information:</span>
                </strong>
                <br />
                If you have any questions or concerns about these Terms, please contact us at [Your Contact
                Information].
              </li>
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
}//