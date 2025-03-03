"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Transaction, PublicKey, Connection } from "@solana/web3.js";
import styles from "../page.module.css";
import { usePhantomWallet } from "../../hooks/usePhantomWallet";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import "@solana/wallet-adapter-react-ui/styles.css";

// Define the expected return type of usePhantomWallet
interface PhantomWalletData {
  walletAddress: string | null | undefined;
  currentDateTime: string;
  balance: number | null;
  handleDeposit: () => Promise<string | undefined>;
  fetchLotteryData: () => void;
  lotteryPot: number;
  participants: string[];
  error: string | null;
	getConnection: () => Connection;
}

export default function SolanaDraw() {
  const {
    walletAddress,
    currentDateTime,
    balance,
    handleDeposit,
    fetchLotteryData,
    lotteryPot,
    participants,
    error,
    getConnection,
  } = usePhantomWallet() as PhantomWalletData;

  const { } = useWallet();

  const [isMounted, setIsMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState("");
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

  useEffect(() => {
    console.log("Solana Draw - Wallet Address:", walletAddress);
    console.log("Solana Draw - Balance:", balance);
  }, [walletAddress, balance]);

  useEffect(() => {
    setIsMounted(true);
    const stars = () => {
      const count = 100;
      const background = document.querySelector(`.${styles.spaceBackground}`);
      if (background) {
        for (let i = 0; i < count; i++) {
          const star = document.createElement("div");
          star.className = styles.star;
          star.style.left = `${Math.random() * 100}%`;
          star.style.top = `${Math.random() * 100}%`;
          star.style.animationDelay = `${Math.random() * 5}s`;
          background.appendChild(star);
        }
      }
    };
    stars();

    fetchLotteryData();
    fetchChatMessages();
    const intervalId = setInterval(fetchLotteryData, 30000);
    return () => clearInterval(intervalId);
  }, [fetchLotteryData]);

  const fetchChatMessages = async () => {
    try {
      const response = await fetch("/api/chat");
      if (!response.ok) throw new Error(`Failed to fetch chat messages: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setMessages(data.map((msg) => `${msg.username}: ${msg.message}`));
      }
    } catch (error) {
      console.error("Error fetching chat messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (walletAddress && newMessage.trim()) {
      const username = walletAddress.slice(0, 4); // TypeScript now knows walletAddress can be a string
      const messageData = { username, message: newMessage, walletAddress };
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messageData),
        });
        if (!response.ok) throw new Error(`Failed to send message: ${response.status}`);
        setMessages((prev) => [...prev, `${username}: ${newMessage}`]);
        setNewMessage("");
      } catch (error) {
        console.error("Error sending message:", error);
        alert("Error sending message");
      }
    } else if (!walletAddress) {
      alert("Please connect your wallet to send messages.");
    }
  };

  const toggleChat = () => {
    if (isChatOpen) {
      setIsChatVisible(false);
      setTimeout(() => setIsChatOpen(false), 800);
    } else {
      setIsChatOpen(true);
      setIsChatVisible(true);
    }
  };

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
        const res = await fetch("/api/visitor-count", { credentials: "include" });
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
      throw new Error(`Failed to fetch latest winner: ${res.status} - ${text}`); // Fixed typo
    }
    const data = await res.json();
    setLatestWinner(data);
  } catch (err) {
    console.error("Error fetching latest winner:", err);
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
        throw new Error(`Failed to prepare VIP payment: ${prepareRes.status} - ${text}`);
      }

      const { nonce, serializedTx } = await prepareRes.json();

      const transaction = Transaction.from(Buffer.from(serializedTx, "base64"));
      const solana = window.solana as { signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }> };
      const { signature } = await solana.signAndSendTransaction(transaction);

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
      alert("Failed to become VIP. Transaction may have failed or timed out. Check your wallet and try again.");
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

  const onlineWallets = participants.includes(walletAddress || "")
    ? participants.length
    : (walletAddress ? 1 : 0) + participants.length;

  return (
    <div className={`${styles.container}`}>
      <div className={`${styles.spaceBackground}`}>
        <div className="w-full text-center text-lg text-gray-300 fixed top-0 left-0 z-50 glow-bottom-border">
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

        <nav className="fixed top-14 left-0 right-0 z-40 bg-transparent py-1 px-4 flex justify-end items-center h-10 space-x-2">
          <button className={styles.navButton}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button className={styles.navButton} onClick={toggleChat}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </button>
          {isMounted && (
            <WalletModalProvider>
              <WalletMultiButton className={styles.walletButton} />
              {walletAddress && (
                <div className="text-white text-sm flex items-center">
                  {typeof balance === "number" ? `${balance.toFixed(4)} SOL` : "Loading..."}
                </div>
              )}
            </WalletModalProvider>
          )}
          <button className={styles.navButton} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {isMenuOpen && (
            <div className={styles.mobileMenu}>
              <Link href="/" className={`${styles.menuLink} text-lg md:text-xl`} onClick={() => setIsMenuOpen(false)}>
                Home
              </Link>
              <Link href="/solana-draw" className={`${styles.menuLink} text-lg md:text-xl`} onClick={() => setIsMenuOpen(false)}>
                Solana Draw
              </Link>
            </div>
          )}
        </nav>

        {isChatOpen && (
          <div
            className={`fixed top-0 left-0 h-full w-1/6 p-4 overflow-y-auto z-40 border-r border-white/10 bg-gray-900/25 ${
              isChatVisible ? styles.chatSlideIn : styles.chatSlideOut
            }`}
          >
            <h3 className={styles.chatTitle}>Chat</h3>
            <div className={styles.chatMessages}>
              {messages.map((msg, index) => (
                <div key={index} className={styles.messageBox}>
                  <p className={styles.messageText}>{msg}</p>
                </div>
              ))}
            </div>
            <div className={styles.chatInputContainer}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className={styles.chatInput}
                placeholder="Type a message..."
              />
              <button onClick={handleSendMessage} className={styles.sendButton}>
                Send
              </button>
            </div>
          </div>
        )}

        <div className={`flex flex-col items-center justify-center min-h-screen relative z-10 ${isChatOpen ? "ml-[16.67%] w-[83.33%]" : ""}`}>
          <div className="mb-2 mt-20">
            <Image
              src="/logo.png"
              alt="Solana Lottery Logo"
              width={600}
              height={500}
              className="object-contain w-auto h-auto"
              priority
            />
          </div>

          <div className="bg-gray-900/75 shadow-lg rounded-lg p-5 max-w-lg w-full mt-5 glow-border relative">
            <main className="flex flex-col items-center">
              <div className="text-center text-gray-300 mb-3">
                <span className="text-2xl block mb-2">
                  🎉 <span className="font-bold text-white hover:underline transition-colors glow">Daily Solana Lottery</span> 🎉
                </span>
                Draw between: <span className="font-bold text-green-200">21:00-22:00 (CET)</span>
                <hr className="border-t border-gray-600 my-4 w-full" />
              </div>

              <p className="text-lg text-center text-gray-300">
                Current Lottery Pot: <span className="font-bold text-green-200">{lotteryPot} $SOL</span>🫰
              </p>

              <p className="text-lg text-center text-gray-300 mb-4">
                Deposit <span className="font-bold text-green-200">0.02 $SOL</span> to enter!
              </p>
              <hr className="border-t border-gray-600 my-4 w-full" />

              {walletAddress && (
                <button
                  onClick={onDeposit}
                  disabled={isDepositing}
                  className={`glow-on-hover rounded-full border border-transparent transition-colors flex items-center justify-center mb-4 ${
                    isDepositing ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isDepositing ? "Depositing..." : "Deposit 0.021 $SOL"}
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

              <p className="text-sm text-center text-gray-300 mb-3">
                Today&apos;s date is <span className="font-bold text-green-200">{currentDateTime}</span> in CET.
              </p>

              {latestWinner?.winner && (
                <p className="text-sm text-center text-gray-300 relative">
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
                  {latestWinner.payoutSignature && (
                    <span
                      onClick={copyPayoutSignatureToClipboard}
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

          <div className="fixed bottom-4 right-4 z-50 flex items-center bg-gray-800/80 text-white rounded-full px-3 py-1 shadow-lg">
            <span
              className={`w-3 h-3 rounded-full mr-2 ${onlineWallets > 0 ? "bg-green-500" : "bg-red-500"}`}
            ></span>
            <span className="text-sm">
              {onlineWallets > 0 ? `${onlineWallets} ONLINE` : "0 ONLINE"}
            </span>
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
                  className="fixed bottom-4 rounded-full border border-white bg-white text-gray-800 px-4 py-2 text-sm hover:bg-gray-200 transition duration-200 ease-in-out"
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
                  className="fixed bottom-4 rounded-full border border-white bg-white text-gray-800 px-4 py-2 text-sm hover:bg-gray-200 transition duration-200 ease-in-out"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}