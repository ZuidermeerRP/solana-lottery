// hooks/usePhantomWallet.js
import { useState, useEffect, useCallback } from "react";
import { Connection, Transaction, PublicKey } from "@solana/web3.js";

export const usePhantomWallet = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState("");
  const [lotteryPot, setLotteryPot] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);

  const RPC_ENDPOINT =
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    "https://broken-indulgent-model.solana-mainnet.quiknode.pro/55d0255c26cdfc79177b04a002f1d1af920f46c8";

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
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
      console.log("Raw CSRF response:", {
        status: res.status,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries()),
        url: res.url,
      });
      const text = await res.text();
      console.log("Raw response text:", text);
      const data = JSON.parse(text);
      console.log("Parsed CSRF data:", data);
      if (!data.csrfToken) {
        throw new Error("CSRF token not found in response");
      }
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

      if (!potRes.ok) {
        const potError = await potRes.text();
        throw new Error(`Pot fetch failed: ${potRes.status} - ${potError}`);
      }
      if (!participantsRes.ok) {
        const participantsError = await participantsRes.text();
        throw new Error(`Participants fetch failed: ${participantsRes.status} - ${participantsError}`);
      }

      const potData = await potRes.json();
      const participantsData = await participantsRes.json();

      console.log("Fetched participants data:", participantsData.participants);
      setLotteryPot(potData.pot || 0);
      setParticipants([...(participantsData.participants || [])]);
      setError(null);
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Request timed out. Please check your network.");
      } else if (err.message.includes("Failed to fetch")) {
        setError("Cannot connect to the server. Is it running?");
      } else {
        setError("Failed to load lottery data: " + err.message);
      }
      console.error("Fetch error details:", err);
    }
  }, []);

  const handleDeposit = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first.");
      return false;
    }

    const connection = getConnection();
    const LAMPORTS_PER_SOL = 1000000000; // 1 SOL = 1,000,000,000 lamports
    const requiredAmount = 0.015 * LAMPORTS_PER_SOL; // 0.015 SOL in lamports (0.01 deposit + 0.005 fee)

    try {
      // Check wallet balance initially
      const balance = await connection.getBalance(new PublicKey(walletAddress));
      if (balance < requiredAmount) {
        setError("Insufficient SOL balance. You need at least 0.015 SOL (0.01 deposit + 0.005 fee).");
        return false;
      }

      const csrfToken = await fetchCsrfToken();
      console.log("CSRF token sent:", csrfToken);
      const prepareRes = await fetchWithTimeout("/api/prepare-deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ walletAddress }),
        credentials: "include",
      });
      if (!prepareRes.ok) {
        const { error } = await prepareRes.json();
        throw new Error(error || "Failed to prepare deposit");
      }
      const { nonce, serializedTx } = await prepareRes.json();

      const transaction = Transaction.from(Buffer.from(serializedTx, "base64"));

      // Sign and send transaction with better error handling
      let signature;
      try {
        const signResult = await window.solana.signAndSendTransaction(transaction);
        signature = signResult.signature;
        console.log("Transaction signature:", signature);
      } catch (signErr) {
        if (signErr.message.includes("insufficient funds")) {
          throw new Error("Insufficient SOL balance detected during transaction signing.");
        }
        throw new Error("Failed to sign and send transaction: " + signErr.message);
      }

      // Confirm transaction with timeout
      const confirmationTimeout = 30000; // 30 seconds timeout
      let attempts = 0;
      const maxAttempts = 3;
      const startTime = Date.now();

      while (attempts < maxAttempts && Date.now() - startTime < confirmationTimeout) {
        try {
          await connection.confirmTransaction(signature, "confirmed");
          break; // Success, exit loop
        } catch (confirmErr) {
          if (++attempts === maxAttempts || Date.now() - startTime >= confirmationTimeout) {
            throw new Error("Transaction confirmation timed out or failed after retries.");
          }
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }

      const depositRes = await fetchWithTimeout("/api/submit-deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
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
  };
};