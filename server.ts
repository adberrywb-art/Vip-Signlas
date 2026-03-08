import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Railway dynamic port
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'adberry.db');

// Ensure DB directory exists if it's a relative path
if (!process.env.DATABASE_URL) {
  const dbDir = path.dirname(DB_PATH);
  import('fs').then(fs => {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  });
}

// HARDCODED TELEGRAM CREDENTIALS
const TELEGRAM_BOT_TOKEN = '8567907115:AAGlbFcIFc4PmLo60MIy_MrDQs_5xN_AIDI';
const TELEGRAM_CHAT_ID = '6883456927';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const db = new Database(DB_PATH);

  // Initialize Adberry Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      capital REAL DEFAULT 1000.0,
      lot_size REAL DEFAULT 0.01,
      success_rate REAL DEFAULT 0.0,
      mt5_account TEXT,
      mt5_password TEXT,
      mt5_server TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT, -- BUY/SELL
      pair TEXT DEFAULT 'EURUSD',
      entry_price REAL,
      sl REAL,
      tp REAL,
      status TEXT DEFAULT 'OPEN', -- OPEN, CLOSED, CANCELLED
      executed_on_mt5 INTEGER DEFAULT 0, -- 0 = No, 1 = Yes
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  app.use(express.json());

  // Socket.io connection
  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    socket.on('disconnect', () => console.log('Cliente desconectado'));
  });

  // Telegram Bot (Global for all users as per request)
  const shouldPoll = process.env.DISABLE_TELEGRAM_POLLING !== 'true';
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: shouldPoll });
  
  if (shouldPoll) {
    console.log(`🤖 Bot de Adberry iniciado para Chat ID: ${TELEGRAM_CHAT_ID}`);
    
    // Enviar mensaje de confirmación al iniciar (opcional, ayuda a saber que está vivo)
    bot.sendMessage(TELEGRAM_CHAT_ID, "🚀 **Terminal ADBERRY Activo**\nEsperando señales de TradingView o mensajes directos...").catch(() => {});

    bot.on('polling_error', (error: any) => {
      if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        console.error('⚠️ Conflicto: El bot ya está corriendo en otro sitio (posiblemente Railway).');
      }
    });
  }
  
  bot.on('message', (msg) => {
    // Log para depuración: ver qué ID de chat está enviando mensajes
    console.log(`Mensaje recibido de Chat ID ${msg.chat.id}: ${msg.text}`);
    
    if (msg.chat.id.toString() === TELEGRAM_CHAT_ID && msg.text) {
      processSignalForAllUsers(msg.text);
    }
  });

  const processSignalForAllUsers = async (text: string) => {
    const msg = text.toLowerCase();
    let type = '';
    
    // Detección más flexible de señales
    if (msg.includes('buy') || msg.includes('compra')) type = 'BUY';
    if (msg.includes('sell') || msg.includes('venta')) type = 'SELL';

    if (type) {
      const slMatch = msg.match(/sl\s+([\d.]+)/);
      const tpMatch = msg.match(/tp\s+([\d.]+)/);
      const pairMatch = msg.match(/([a-z]{6})/); // Busca pares como eurusd
      
      const sl = slMatch ? parseFloat(slMatch[1]) : null;
      const tp = tpMatch ? parseFloat(tpMatch[1]) : null;
      const pair = pairMatch ? pairMatch[1].toUpperCase() : 'EURUSD';

      // Mock entry price (en producción esto vendría del mensaje o de un API de precios)
      const entryPrice = 1.0850 + (Math.random() * 0.0010);

      const users = db.prepare('SELECT id, username, lot_size FROM users').all();
      
      for (const user of users) {
        const info = db.prepare('INSERT INTO signals (user_id, type, pair, sl, tp, entry_price, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(user.id, type, pair, sl, tp, entryPrice, 'OPEN');
        
        const newSignal = {
          id: info.lastInsertRowid,
          user_id: user.id,
          type,
          pair,
          entry_price: entryPrice,
          sl,
          tp,
          status: 'OPEN',
          profit: 0,
          result: 'PENDING',
          timestamp: new Date().toISOString()
        };

        io.emit('new_signal', newSignal);
      }
      
      console.log(`✅ Señal global procesada: ${type} ${pair} @ ${entryPrice}`);
    }
  };

  // TradingView Webhook Endpoint (Simplified for MT5)
  app.post('/api/tradingview/webhook', (req, res) => {
    const { type, pair, sl, tp } = req.body;
    
    console.log('🔔 Webhook de TradingView recibido:', req.body);

    if (type && pair) {
      processSignalForAllUsers(`${type} ${pair} SL ${sl || ''} TP ${tp || ''}`);
    }
    
    res.json({ success: true });
  });

  // MT5 Polling Endpoint
  app.get('/api/mt5/pending/:account', (req, res) => {
    const { account } = req.params;
    const user = db.prepare('SELECT id, lot_size FROM users WHERE mt5_account = ?').get(account);
    
    if (!user) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const pendingSignals = db.prepare('SELECT * FROM signals WHERE user_id = ? AND executed_on_mt5 = 0').all(user.id);
    res.json({ signals: pendingSignals, lot_size: user.lot_size });
  });

  // MT5 Confirmation Endpoint
  app.post('/api/mt5/confirm', (req, res) => {
    const { signal_id } = req.body;
    db.prepare('UPDATE signals SET executed_on_mt5 = 1 WHERE id = ?').run(signal_id);
    res.json({ success: true });
  });

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const info = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
      res.json({ id: info.lastInsertRowid, username, capital: 1000, lot_size: 0.01, success_rate: 0 });
    } catch (e) {
      res.status(400).json({ error: 'Usuario ya existe' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (user && await bcrypt.compare(password, user.password)) {
      res.json(user);
    } else {
      res.status(401).json({ error: 'Credenciales inválidas' });
    }
  });

  // Test Signal Route
  app.post('/api/test/signal', (req, res) => {
    const { user_id } = req.body;
    const type = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const entryPrice = 1.0850 + (Math.random() * 0.0010);
    
    const info = db.prepare('INSERT INTO signals (user_id, type, entry_price, status) VALUES (?, ?, ?, ?)')
      .run(user_id, type, entryPrice, 'OPEN');
    
    const newSignal = {
      id: info.lastInsertRowid,
      user_id,
      type,
      pair: 'EURUSD',
      entry_price: entryPrice,
      sl: entryPrice - 0.0020,
      tp: entryPrice + 0.0020,
      status: 'OPEN',
      profit: 0,
      result: 'PENDING',
      timestamp: new Date().toISOString()
    };

    io.emit('new_signal', newSignal);
    res.json({ success: true });
  });

  // Bot Status Endpoint
  app.get('/api/bot/status', (req, res) => {
    res.json({ connected: true }); // Since it's running in the same process
  });

  // User Routes
  app.get('/api/user/:id', (req, res) => {
    const user = db.prepare('SELECT id, username, capital, lot_size, success_rate, mt5_account, mt5_server FROM users WHERE id = ?').get(req.params.id);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  });

  app.post('/api/user/:id/settings', (req, res) => {
    const { lot_size, capital, mt5_account, mt5_password, mt5_server } = req.body;
    
    if (mt5_account !== undefined) {
      db.prepare('UPDATE users SET lot_size = ?, capital = ?, mt5_account = ?, mt5_password = ?, mt5_server = ? WHERE id = ?')
        .run(parseFloat(lot_size), parseFloat(capital), mt5_account, mt5_password, mt5_server, req.params.id);
    } else {
      db.prepare('UPDATE users SET lot_size = ?, capital = ? WHERE id = ?')
        .run(parseFloat(lot_size), parseFloat(capital), req.params.id);
    }
    
    res.json({ success: true });
  });

  // Signals Routes
  app.get('/api/user/:id/signals', (req, res) => {
    const signals = db.prepare('SELECT * FROM signals WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50').all(req.params.id);
    res.json(signals);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
