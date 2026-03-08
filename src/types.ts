export interface User {
  id: number;
  username: string;
  capital: number;
  lot_size: number;
  success_rate: number;
  mt5_account?: string;
  mt5_server?: string;
}

export interface Signal {
  id: number;
  user_id: number;
  type: 'BUY' | 'SELL';
  pair: string;
  entry_price: number;
  sl: number | null;
  tp: number | null;
  status: string;
  executed_on_mt5: number;
  timestamp: string;
}
