import { useState, useEffect, useCallback } from "react";
import { Connection, Transaction } from "@solana/web3.js";

export const usePhantomWallet = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState("");
  const [lotteryPot, setLotteryPot] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);

  const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://broken-indulgent-model.solana-mainnet.quiknode.pro/55d0255c26cdfc79177b04a002f1d1af920f46c8";
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const getConnection = () => {
    // Use HTTP only, disable WebSocket to avoid wss errors
    return new Connection(RPC_ENDPOINT, { commitment: "confirmed", disableWebSocket: true });
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
      const res = await fetchWithTimeout(`${BACKEND_URL}/csrf-token`, { 
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch CSRF token: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
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
      fetchWithTimeout(`${BACKEND_URL}/lottery-pot`, { credentials: "include" }),
      fetchWithTimeout(`${BACKEND_URL}/participants`, { credentials: "include" }),
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

    console.log("Fetched participants data:", participantsData.participants); // Debugging
    setLotteryPot(potData.pot || 0);
    setParticipants([...(participantsData.participants || [])]); // Force new array
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
}, [])

  const handleDeposit = async () => {
  if (!walletAddress) {
    setError("Please connect your wallet first.");
    return false;
  }

  const connection = getConnection();

  try {
    const csrfToken = await fetchCsrfToken();
    console.log("CSRF token sent:", csrfToken);
    const prepareRes = await fetchWithTimeout(`${BACKEND_URL}/prepare-deposit`, {
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
    const { signature } = await window.solana.signAndSendTransaction(transaction);
    console.log("Transaction signature:", signature);

    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        await connection.confirmTransaction(signature, "confirmed");
        break;
      } catch (err) {
        if (++attempts === maxAttempts) throw new Error("Transaction confirmation failed after retries");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const depositRes = await fetchWithTimeout(`${BACKEND_URL}/submit-deposit`, {
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
    return signature; // Return the signature instead of boolean
  } catch (err) {
    const userFriendlyError = err.message.includes("Failed to")
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