// hooks/usePhantomWallet.js
import { useState, useEffect, useCallback } from "react";
import { Connection, Transaction, PublicKey, SystemProgram } from "@solana/web3.js";

export const usePhantomWallet = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState("");
  const [lotteryPot, setLotteryPot] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);

  const RPC_ENDPOINT =
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    "https://broken-indulgent-model.solana-mainnet.quiknode.pro/55d0255c26cdfc79177b04a002f1d1af920f46c8";

  const LOTTERY_WALLET = new PublicKey("CFLcvynnCrfQHcevyosen2yFp8qj59JPxjRww4MWPi28");
  const FEE_WALLET = new PublicKey("AhYVXTS9ASNLkoUGd5u65F7uaNJSwddfTwnK7yV1YDVr");
  const LOTTERY_AMOUNT = 0.02 * 1e9; // 0.01 SOL in lamports
  const FEE_AMOUNT = 0.001 * 1e9;    // 0.005 SOL in lamports

  const getConnection = () => {
    return new Connection(RPC_ENDPOINT, { commitment: "confirmed" });
  };

  const fetchWithTimeout = async (url, options, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const fetchCsrfToken = async () => {
    try {
      const res = await fetch("/api/csrf-token", {
        credentials: "include",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      });
      const text = await res.text();
      const data = JSON.parse(text);
      if (!data.csrfToken) throw new Error("CSRF token not found in response");
      return data.csrfToken;
    } catch (error) {
      console.error("CSRF fetch error:", error);
      throw error;
    }
  };

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date().toLocaleString("en-NL", {
        timeZone: "Europe/Amsterdam",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
      setCurrentDateTime(now);
    };
    updateDateTime();
    const intervalId = setInterval(updateDateTime, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const connectToPhantom = async () => {
    if (!window.solana?.isPhantom) {
      setError("Phantom wallet not detected. Please install the extension.");
      return false;
    }
    try {
      const response = await window.solana.connect();
      setWalletAddress(response.publicKey.toString());
      setError(null);
      return true;
    } catch (err) {
      setError("Failed to connect to Phantom wallet.");
      console.error("Phantom connection error:", err);
      return false;
    }
  };

  const fetchLotteryData = useCallback(async () => {
    try {
      const [potRes, participantsRes] = await Promise.all([
        fetchWithTimeout("/api/lottery-pot", { credentials: "include" }),
        fetchWithTimeout("/api/participants", { credentials: "include" }),
      ]);

      if (!potRes.ok) throw new Error(`Pot fetch failed: ${await potRes.text()}`);
      if (!participantsRes.ok) throw new Error(`Participants fetch failed: ${await participantsRes.text()}`);

      const potData = await potRes.json();
      const participantsData = await participantsRes.json();

      setLotteryPot(potData.pot || 0);
      setParticipants([...(participantsData.participants || [])]);
      setError(null);
    } catch (err) {
      setError(
        err.name === "AbortError"
          ? "Request timed out. Please check your network."
          : err.message.includes("Failed to fetch")
          ? "Cannot connect to the server. Is it running?"
          : "Failed to load lottery data: " + err.message
      );
      console.error("Fetch error details:", err);
    }
  }, []);

  const handleDeposit = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first.");
      return false;
    }

    const connection = getConnection();
    const LAMPORTS_PER_SOL = 1e9;
    const TOTAL_LAMPORTS = LOTTERY_AMOUNT + FEE_AMOUNT; // 0.015 SOL

    try {
      // Check wallet balance
      const balance = await connection.getBalance(new PublicKey(walletAddress));
      if (balance < TOTAL_LAMPORTS) {
        setError(
          `Insufficient SOL balance. Need ${TOTAL_LAMPORTS / LAMPORTS_PER_SOL} SOL, have ${balance / LAMPORTS_PER_SOL} SOL`
        );
        return false;
      }

      const csrfToken = await fetchCsrfToken();

      // Fetch nonce from server (still needed for deposit submission)
      const prepareRes = await fetchWithTimeout("/api/prepare-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ walletAddress }),
        credentials: "include",
      });
      if (!prepareRes.ok) throw new Error((await prepareRes.json()).error || "Failed to prepare deposit");
      const { nonce } = await prepareRes.json();

      // Create transaction with two transfers
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: LOTTERY_WALLET,
          lamports: LOTTERY_AMOUNT,
        }),
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: FEE_WALLET,
          lamports: FEE_AMOUNT,
        })
      );

      // Set recent blockhash and fee payer
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(walletAddress);

      // Sign and send transaction
      const { signature } = await window.solana.signAndSendTransaction(transaction);
      console.log("Transaction signature:", signature);

      // Confirm transaction
      const confirmationTimeout = 30000;
      let attempts = 0;
      const maxAttempts = 3;
      const startTime = Date.now();

      while (attempts < maxAttempts && Date.now() - startTime < confirmationTimeout) {
        try {
          await connection.confirmTransaction(signature, "confirmed");
          break;
        } catch (confirmErr) {
          if (++attempts === maxAttempts || Date.now() - startTime >= confirmationTimeout) {
            throw new Error("Transaction confirmation timed out or failed after retries.");
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Submit deposit to server
      const depositRes = await fetchWithTimeout("/api/submit-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ walletAddress, signature, nonce }),
        credentials: "include",
      });

      if (!depositRes.ok) {
        const { error, details } = await depositRes.json();
        throw new Error(`${error}${details ? `: ${JSON.stringify(details)}` : ""}`);
      }

      await fetchLotteryData();
      setError(null);
      return signature;
    } catch (err) {
      const userFriendlyError =
        err.message.includes("insufficient funds") || err.message.includes("Insufficient SOL balance")
          ? "Insufficient SOL balance. Please ensure you have at least 0.015 SOL available."
          : err.message.includes("Failed to") || err.message.includes("timed out")
          ? err.message
          : "An unexpected error occurred. Please try again.";
      setError(userFriendlyError);
      console.error("Deposit error full details:", err);
      return false;
    }
  };

  return {
    walletAddress,
    currentDateTime,
    lotteryPot,
    participants,
    error,
    connectToPhantom,
    handleDeposit,
    fetchLotteryData,
    getConnection,
  };
};