export interface User {
  id: number;
  username: string;
  capital: number;
  lot_size: number;
  success_rate: number;
}

export interface TelegramConfig {
  api_id: string;
  api_hash: string;
  bot_token: string;
  chat_id: string;
}

export interface Signal {
  id: number;
  user_id: number;
  type: 'BUY' | 'SELL';
  pair: string;
  entry_price: number;
  sl: number;
  tp: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  profit: number;
  result: 'WIN' | 'LOSS' | 'PENDING';
  timestamp: string;
}
