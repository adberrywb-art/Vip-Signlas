import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import TelegramBot from "node-telegram-bot-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "adberry-secret-key-123";

// Database Initialization (Wrapped in try-catch)
let db: any;
try {
  db = new Database("adberry.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      telegram_token TEXT,
      chat_id TEXT,
      lot_size REAL DEFAULT 0.01,
      balance REAL DEFAULT 1000.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      pair TEXT,
      type TEXT,
      entry_price REAL,
      sl REAL,
      tp REAL,
      status TEXT DEFAULT 'PENDING',
      result TEXT,
      profit REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
  console.log("✅ Database initialized");
} catch (err) {
  console.error("❌ Database error:", err);
  // Fallback to memory DB if file fails
  db = new Database(":memory:");
}

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- API Routes ---
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    const info = stmt.run(username, hashedPassword);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(400).json({ error: "El usuario ya existe" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user: any = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: "Error en el login" });
  }
});

app.get("/api/user/settings", authenticateToken, (req: any, res) => {
  const user = db.prepare("SELECT id, username, telegram_token, chat_id, lot_size, balance FROM users WHERE id = ?").get(req.user.id);
  res.json(user);
});

app.post("/api/user/settings", authenticateToken, (req: any, res) => {
  const { telegram_token, chat_id, lot_size, balance } = req.body;
  db.prepare("UPDATE users SET telegram_token = ?, chat_id = ?, lot_size = ?, balance = ? WHERE id = ?")
    .run(telegram_token, chat_id, lot_size, balance, req.user.id);
  
  if (telegram_token && chat_id) {
    setupUserBot(req.user.id, telegram_token, chat_id);
  }
  res.json({ success: true });
});

app.get("/api/signals", authenticateToken, (req: any, res) => {
  const signals = db.prepare("SELECT * FROM signals WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50").all(req.user.id);
  res.json(signals);
});

// --- Telegram Bot Logic ---
const activeBots = new Map<number, TelegramBot>();

function setupUserBot(userId: number, token: string, chatId: string) {
  if (!token || token.trim() === "" || !chatId || chatId.trim() === "") return;

  if (activeBots.has(userId)) {
    try {
      const existingBot = activeBots.get(userId);
      if (existingBot) existingBot.stopPolling();
    } catch (e) {
      console.error(`Error stopping bot for user ${userId}:`, e);
    }
    activeBots.delete(userId);
  }

  try {
    if (!/^\d+:[\w-]+$/.test(token)) return;

    const bot = new TelegramBot(token, { polling: true });
    activeBots.set(userId, bot);

    bot.on("message", (msg) => {
      if (msg.chat.id.toString() !== chatId) return;
      const text = msg.text?.toLowerCase();
      if (!text) return;

      if (text.includes("eurusd") || text.includes("buy now") || text.includes("sell now")) {
        let type = text.includes("buy") ? "BUY" : text.includes("sell") ? "SELL" : "UNKNOWN";
        const slMatch = text.match(/sl:?\s*([\d.]+)/);
        const tpMatch = text.match(/tp:?\s*([\d.]+)/);
        const sl = slMatch ? parseFloat(slMatch[1]) : null;
        const tp = tpMatch ? parseFloat(tpMatch[1]) : null;

        if (type !== "UNKNOWN") {
          const stmt = db.prepare("INSERT INTO signals (user_id, pair, type, sl, tp, status) VALUES (?, ?, ?, ?, ?, ?)");
          stmt.run(userId, "EURUSD", type, sl, tp, "EXECUTED");
          
          setTimeout(() => {
            const result = Math.random() > 0.3 ? "WIN" : "LOSS";
            const profit = result === "WIN" ? (Math.random() * 50 + 10) : -(Math.random() * 30 + 5);
            db.prepare("UPDATE signals SET status = 'CLOSED', result = ?, profit = ? WHERE user_id = ? AND status = 'EXECUTED'")
              .run(result, profit, userId);
            db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(profit, userId);
          }, 5000);
        }
      }
    });
  } catch (error) {
    console.error(`Error starting bot for user ${userId}:`, error);
  }
}

// Test Telegram Bot
app.post("/api/user/test-telegram", authenticateToken, async (req: any, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token requerido" });
  try {
    const tempBot = new TelegramBot(token);
    const me = await tempBot.getMe();
    res.json({ success: true, bot_name: me.username });
  } catch (error) {
    res.status(400).json({ error: "Token inválido o error de conexión" });
  }
});

// TradingView Webhook
app.post("/api/webhook/tradingview", async (req, res) => {
  const { secret, pair, type, sl, tp, user_id } = req.body;
  if (secret !== "adberry-webhook-secret") return res.status(401).json({ error: "No autorizado" });
  if (!user_id || !pair || !type) return res.status(400).json({ error: "Datos incompletos" });

  try {
    const stmt = db.prepare("INSERT INTO signals (user_id, pair, type, sl, tp, status) VALUES (?, ?, ?, ?, ?, ?)");
    stmt.run(user_id, pair, type.toUpperCase(), sl, tp, "EXECUTED");
    
    setTimeout(() => {
      const result = Math.random() > 0.3 ? "WIN" : "LOSS";
      const profit = result === "WIN" ? (Math.random() * 50 + 10) : -(Math.random() * 30 + 5);
      db.prepare("UPDATE signals SET status = 'CLOSED', result = ?, profit = ? WHERE user_id = ? AND status = 'EXECUTED' AND pair = ?")
        .run(result, profit, user_id, pair);
      db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(profit, user_id);
    }, 5000);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al procesar webhook" });
  }
});

// --- Server Start ---
async function start() {
  const isProd = process.env.NODE_ENV === "production";
  
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  app.listen(3000, "0.0.0.0", () => {
    console.log("🚀 Server running on http://0.0.0.0:3000");
  });
}

start().catch(console.error);
