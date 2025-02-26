const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Connection, PublicKey, Transaction, SystemProgram, Keypair } = require("@solana/web3.js");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const dotenv = require("dotenv");
const { body, validationResult } = require("express-validator");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");
const cron = require("node-cron");
const WebSocket = require("ws");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// WebSocket server setup
const wss = new WebSocket.Server({ port: 3002 });
let clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter(client => client !== ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

const broadcastRefresh = () => {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send("refresh");
    }
  });
};

// CORS configuration
const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
};
app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Cookie parser
app.use(cookieParser());

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true },
  })
);

// CSRF middleware applied globally for token generation
const csrfMiddleware = csurf({ cookie: true });
app.use(csrfMiddleware);

// MongoDB connection
const mongoURI = process.env.MONGO_URI;
mongoose
  .connect(mongoURI)
  .catch((err) => console.error("MongoDB connection error:", err));

// Schemas
const depositSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  signature: { type: String, unique: true },
  nonce: { type: String },
  createdAt: { type: Date, default: Date.now },
});
const Deposit = mongoose.model("Deposit", depositSchema);

const nonceSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  nonce: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: "1h" },
});
const Nonce = mongoose.model("Nonce", nonceSchema);

const winnerSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  payoutSignature: { type: String, unique: true },
  drawnAt: { type: Date, default: Date.now },
});
const Winner = mongoose.model("Winner", winnerSchema);

// Solana configuration
const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  "confirmed"
);
const LOTTERY_WALLET_PUBLIC_KEY = "CFLcvynnCrfQHcevyosen2yFp8qj59JPxjRww4MWPi28";
const LOTTERY_WALLET_PRIVATE_KEY = process.env.LOTTERY_WALLET_PRIVATE_KEY
  ? JSON.parse(process.env.LOTTERY_WALLET_PRIVATE_KEY)
  : null;
const LOTTERY_WALLET = LOTTERY_WALLET_PRIVATE_KEY ? Keypair.fromSecretKey(Uint8Array.from(LOTTERY_WALLET_PRIVATE_KEY)) : null;
const LOTTERY_AMOUNT = 0.01;
const FEE_AMOUNT = 0.005;
const TOTAL_LAMPORTS = (LOTTERY_AMOUNT + FEE_AMOUNT) * 1e9;

// Routes
app.get("/csrf-token", (req, res) => {
  try {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  } catch (error) {
    console.error("Error generating CSRF token:", error.stack);
    res.status(500).json({ error: "Failed to generate CSRF token", details: error.message });
  }
});

app.get("/lottery-pot", async (req, res) => {
  try {
    const deposits = await Deposit.find();
    const totalPot = deposits.reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
    res.json({ pot: totalPot });
  } catch (error) {
    console.error("Error fetching lottery pot:", error.stack);
    res.status(500).json({ error: "Failed to fetch lottery pot", details: error.message });
  }
});

app.get("/participants", async (req, res) => {
  try {
    const deposits = await Deposit.find({}, "walletAddress");
    const participants = deposits.map(deposit => deposit.walletAddress);
    res.json({ participants });
  } catch (error) {
    console.error("Error fetching participants:", error.stack);
    res.status(500).json({ error: "Failed to fetch participants", details: error.message });
  }
});

app.get("/latest-winner", async (req, res) => {
  try {
    const latestWinner = await Winner.findOne().sort({ drawnAt: -1 });
    res.json({
      winner: latestWinner ? latestWinner.walletAddress : null,
      amount: latestWinner ? latestWinner.amount : 0,
      drawnAt: latestWinner ? latestWinner.drawnAt : null,
    });
  } catch (error) {
    console.error("Error fetching latest winner:", error.stack);
    res.status(500).json({ error: "Failed to fetch latest winner", details: error.message });
  }
});

app.post("/prepare-deposit", csrfMiddleware, [body("walletAddress").isString().notEmpty()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { walletAddress } = req.body;

  try {
    const nonce = Math.random().toString(36).substring(2);
    await new Nonce({ walletAddress, nonce }).save();

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: new PublicKey(walletAddress),
    }).add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(walletAddress),
        toPubkey: new PublicKey(LOTTERY_WALLET_PUBLIC_KEY),
        lamports: TOTAL_LAMPORTS,
      })
    );

    const serializedTx = transaction.serialize({ requireAllSignatures: false }).toString("base64");
    res.json({ nonce, serializedTx });
  } catch (error) {
    console.error("Error preparing deposit:", error.stack);
    res.status(500).json({ error: "Failed to prepare deposit" });
  }
});

app.post("/submit-deposit", csrfMiddleware, [
  body("walletAddress").isString().notEmpty(),
  body("signature").isString().notEmpty(),
  body("nonce").isString().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { walletAddress, signature, nonce } = req.body;

  try {
    const nonceDoc = await Nonce.findOneAndDelete({ walletAddress, nonce });
    if (!nonceDoc) {
      return res.status(400).json({ error: "Invalid or expired nonce" });
    }

    const tx = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
      return res.status(400).json({ error: "Transaction not found or not confirmed" });
    }

    const instructions = tx.transaction.message.instructions;
    if (!instructions || instructions.length === 0) {
      return res.status(400).json({ error: "No instructions found in transaction" });
    }

    const transfer = instructions.find((instr) => {
      return (
        instr.programId.toString() === SystemProgram.programId.toString() &&
        instr.parsed?.type === "transfer"
      );
    });

    if (!transfer) {
      return res.status(400).json({ error: "No valid transfer instruction found" });
    }

    const { lamports, destination } = transfer.parsed.info;
    if (lamports !== TOTAL_LAMPORTS || destination !== LOTTERY_WALLET_PUBLIC_KEY) {
      return res.status(400).json({
        error: "Invalid deposit amount or destination",
        details: { lamports, expected: TOTAL_LAMPORTS, destination, expected: LOTTERY_WALLET_PUBLIC_KEY },
      });
    }

    const deposit = new Deposit({
      walletAddress,
      amount: LOTTERY_AMOUNT,
      signature,
      nonce,
    });
    await deposit.save();

    res.json({ message: "Deposit verified and saved" });
  } catch (error) {
    console.error("Error processing deposit:", error.stack);
    res.status(500).json({ error: "Failed to process deposit", details: error.message });
  }
});

// Cron job to pick winner and payout at 21:00 CET daily
cron.schedule("* * * * *", async () => {
  try {
    const deposits = await Deposit.find();
    const participants = deposits.map(deposit => deposit.walletAddress);

    if (participants.length === 0) {
      return;
    }

    const totalPot = deposits.reduce((sum, deposit) => {
      const amount = deposit.amount || 0;
      return sum + amount;
    }, 0);
    if (totalPot <= 0) {
      return;
    }

    const winnerIndex = Math.floor(Math.random() * participants.length);
    const winnerAddress = participants[winnerIndex];

    if (!LOTTERY_WALLET) {
      return;
    }

    try {
      new PublicKey(winnerAddress);
    } catch (e) {
      return;
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
    broadcastRefresh();
  } catch (error) {
    console.error("Error during lottery draw:", error.stack);
  }
}, {
  timezone: "Europe/Amsterdam"
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});