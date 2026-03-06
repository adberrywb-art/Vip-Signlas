import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { 
  TrendingUp, 
  Settings, 
  History, 
  User as UserIcon, 
  LogOut, 
  Bell, 
  ShieldCheck, 
  Activity,
  DollarSign,
  Percent,
  Lock,
  ChevronRight,
  AlertCircle,
  BarChart3,
  Globe,
  Cpu,
  Zap,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { User, Signal } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('adberry_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [signals, setSignals] = useState<Signal[]>([]);
  const [settings, setSettings] = useState({ 
    lot_size: 0.01, 
    capital: 1000,
    mt5_account: '',
    mt5_password: '',
    mt5_server: ''
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'contacts' | 'terms' | 'socials'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [isBotConnected, setIsBotConnected] = useState(true);

  const APP_URL = "https://ais-pre-3xs4d7r7dz4zakbrvdwexd-368173605673.us-east1.run.app";

  useEffect(() => {
    if (user) {
      localStorage.setItem('adberry_user', JSON.stringify(user));
      fetchData();
    }
  }, [user?.id]); // Only re-run if user ID changes

  useEffect(() => {
    if (!user) return;

    const socket = io();
    
    socket.on('connect', () => console.log('Socket conectado'));

    socket.on('new_signal', (signal: Signal) => {
      if (signal.user_id === user.id) {
        setSignals(prev => [signal, ...prev]);
      }
    });

    socket.on('signal_update', (update: { id: number, status: string, profit: number, result: string }) => {
      setSignals(prev => prev.map(s => s.id === update.id ? { ...s, ...update } as Signal : s));
      // Refresh user data to update capital
      fetchUserData();
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setUser(prev => ({ ...prev, ...data }));
        setSettings({ 
          lot_size: data.lot_size, 
          capital: data.capital,
          mt5_account: data.mt5_account || '',
          mt5_password: '', // Don't fetch password
          mt5_server: data.mt5_server || ''
        });
      }
    } catch (err) {}
  };

  const fetchData = async () => {
    if (!user) return;
    try {
      const sigRes = await fetch(`/api/user/${user.id}/signals`);
      const sigData = await sigRes.json();
      setSignals(sigData);

      const botRes = await fetch('/api/bot/status');
      if (botRes.ok) {
        const botData = await botRes.json();
        setIsBotConnected(botData.connected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adberry_user');
    setUser(null);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setSettings({ 
          lot_size: data.lot_size, 
          capital: data.capital,
          mt5_account: data.mt5_account || '',
          mt5_password: '',
          mt5_server: data.mt5_server || ''
        });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/user/${user.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Ajustes de riesgo actualizados');
        setShowSettings(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = useMemo(() => {
    let current = settings.capital;
    return [...signals].reverse().map((s) => {
      current += s.profit || 0;
      return {
        name: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: parseFloat(current.toFixed(2))
      };
    });
  }, [signals, settings.capital]);

  const totalProfit = useMemo(() => {
    return signals.reduce((acc, s) => acc + (s.profit || 0), 0);
  }, [signals]);

  const winRate = useMemo(() => {
    const closedSignals = signals.filter(s => s.result !== 'PENDING');
    if (closedSignals.length === 0) return 0;
    const wins = closedSignals.filter(s => s.result === 'WIN').length;
    return (wins / closedSignals.length) * 100;
  }, [signals]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans selection:bg-rose-500/30">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative"
        >
          <div className="bg-[#0F172A]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/50">
            <div className="flex flex-col items-center mb-10">
              <div className="relative group mb-6">
                <div className="absolute inset-0 bg-rose-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative w-20 h-20 bg-gradient-to-tr from-rose-600 to-rose-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-rose-500/40 rotate-3 group-hover:rotate-0 transition-all duration-500">
                  <Activity className="text-white" size={40} strokeWidth={2.5} />
                </div>
              </div>
              <h1 className="text-4xl font-black text-white tracking-[-0.05em]" translate="no">ADBERRY</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="h-[1px] w-6 bg-rose-500/30" />
                <p className="text-rose-500 font-black text-[10px] uppercase tracking-[0.4em]">Quantum Terminal</p>
                <span className="h-[1px] w-6 bg-rose-500/30" />
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identidad</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all"
                    placeholder="Nombre de usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Acceso</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-500 transition-colors" size={18} />
                  <input 
                    type="password" 
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all"
                    placeholder="Contraseña segura"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 text-rose-400 text-xs bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-rose-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Procesando...' : isLogin ? 'ENTRAR AL TERMINAL' : 'CREAR CUENTA'}
                {!isLoading && <ChevronRight size={18} />}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-slate-500 hover:text-rose-500 text-xs font-bold transition-colors uppercase tracking-widest"
              >
                {isLogin ? '¿Nuevo en Adberry? Regístrate' : '¿Ya eres miembro? Accede'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-[#0F172A]/60 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-rose-500 blur-xl opacity-10 group-hover:opacity-30 transition-opacity" />
            <div className="relative w-8 h-8 bg-slate-900 border border-white/10 rounded-lg flex items-center justify-center shadow-2xl group-hover:border-rose-500/50 transition-all duration-500">
              <Activity className="text-rose-500" size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-base tracking-[-0.02em] text-white block leading-none" translate="no">ADBERRY</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.3em] block">QUANTUM_V2.0</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-6 px-6 border-x border-white/5 h-full">
            {[
              { pair: 'EURUSD', price: '1.08542', change: '+0.02%' },
              { pair: 'GBPUSD', price: '1.26431', change: '-0.12%' },
              { pair: 'USDJPY', price: '149.821', change: '+0.45%' },
            ].map((ticker, i) => (
              <div key={i} className="flex items-center gap-2 font-mono">
                <span className="text-[9px] font-bold text-slate-500">{ticker.pair}</span>
                <span className="text-[10px] font-black text-white">{ticker.price}</span>
                <span className={cn("text-[8px] font-bold", ticker.change.startsWith('+') ? 'text-emerald-500' : 'text-rose-500')}>
                  {ticker.change}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowWebhookGuide(true)}
              className="flex items-center gap-2 bg-rose-500/5 hover:bg-rose-500/10 px-3 py-1.5 rounded-md border border-rose-500/20 text-rose-500 transition-all text-[9px] font-black uppercase tracking-widest"
            >
              <Globe size={12} />
              API_BRIDGE
            </button>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-1.5 pr-3 rounded-lg border border-white/5 transition-all"
            >
              <div className="w-7 h-7 bg-slate-800 rounded-md flex items-center justify-center text-rose-500">
                <Menu size={14} />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[10px] font-bold text-white leading-none">TERMINAL</p>
              </div>
              <ChevronDown size={12} className={cn("text-slate-500 transition-transform", isMenuOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-64 bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl p-2 z-[100] backdrop-blur-2xl"
                >
                  <div className="px-4 py-3 border-b border-white/5 mb-2">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Usuario</p>
                    <p className="text-sm font-bold text-white">{user.username}</p>
                  </div>

                  <button 
                    onClick={() => { setActiveTab('dashboard'); setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold",
                      activeTab === 'dashboard' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <LayoutDashboard size={18} />
                    Panel de Control
                  </button>

                  <button 
                    onClick={() => { setActiveTab('history'); setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold",
                      activeTab === 'history' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <History size={18} />
                    Historial de Señales
                  </button>

                  <div className="h-[1px] bg-white/5 my-2" />

                  <button 
                    onClick={() => { setActiveTab('contacts'); setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold",
                      activeTab === 'contacts' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <UserIcon size={18} />
                    Contactos
                  </button>

                  <button 
                    onClick={() => { setActiveTab('terms'); setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold",
                      activeTab === 'terms' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <ShieldCheck size={18} />
                    Términos y Condiciones
                  </button>

                  <button 
                    onClick={() => { setActiveTab('socials'); setIsMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold",
                      activeTab === 'socials' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <Globe size={18} />
                    Redes Sociales
                  </button>

                  <div className="h-[1px] bg-white/5 my-2" />

                  <button 
                    onClick={() => { setShowSettings(true); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all text-sm font-bold"
                  >
                    <Settings size={18} className="text-rose-500" />
                    Configuración de Riesgo
                  </button>

                  <div className="h-[1px] bg-white/5 my-2" />

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all text-sm font-bold"
                  >
                    <LogOut size={18} />
                    Cerrar Sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-[#020617]">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-rose-500/5 blur-[150px] pointer-events-none" />
        
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Equity Balance', value: `$${settings.capital.toLocaleString()}`, icon: DollarSign, color: 'rose' },
                    { label: 'Bot Status', value: isBotConnected ? 'CONECTADO' : 'DESCONECTADO', icon: Activity, color: isBotConnected ? 'emerald' : 'rose' },
                    { label: 'Active Lot', value: settings.lot_size, icon: Zap, color: 'amber' },
                    { label: 'Pending MT5', value: signals.filter(s => s.executed_on_mt5 === 0).length, icon: Cpu, color: 'blue' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#0F172A]/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-2xl rounded-full -mr-12 -mt-12" />
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={cn("p-2.5 rounded-lg", `bg-${stat.color}-500/10 text-${stat.color}-500`)}>
                          <stat.icon size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-0.5">{stat.label}</p>
                          <p className="text-xl font-black text-white tracking-tight">{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Chart Section */}
                  <div className="lg:col-span-2 bg-[#0F172A]/40 backdrop-blur-md border border-white/5 p-6 rounded-3xl shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">
                          Equity Performance
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Live Feed</span>
                      </div>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#E11D48" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#E11D48" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                          <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem' }}
                            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="value" stroke="#E11D48" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Monitor Section */}
                  <div className="bg-[#0F172A]/40 backdrop-blur-md border border-white/5 p-6 rounded-3xl shadow-2xl flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">
                          Live Signals
                        </h3>
                      </div>
                      <div className="px-2 py-0.5 bg-emerald-500/10 rounded text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                        Active
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                      {signals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-20 text-center py-10">
                          <Activity size={32} className="mb-3 text-rose-500" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting Data...</p>
                        </div>
                      ) : (
                        signals.slice(0, 8).map((signal) => (
                          <div key={signal.id} className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex items-center justify-between group hover:bg-slate-800/50 transition-all border-l-2 border-l-transparent hover:border-l-rose-500">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-7 h-7 rounded flex items-center justify-center font-black text-[9px] border",
                                signal.type === 'BUY' ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/5 text-rose-500 border-rose-500/20'
                              )}>
                                {signal.type.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-white text-[10px] leading-none">{signal.pair || 'EURUSD'}</p>
                                  <span className="text-[8px] font-bold text-slate-600">M5</span>
                                </div>
                                <p className="text-[9px] text-slate-500 font-mono mt-1">@{signal.entry_price.toFixed(4)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={cn(
                                "text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter mb-1 inline-block",
                                signal.executed_on_mt5 === 1 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                              )}>
                                {signal.executed_on_mt5 === 1 ? 'MT5_OK' : 'MT5_WAIT'}
                              </div>
                              <p className="text-[8px] font-bold text-slate-600 font-mono">
                                {new Date(signal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#0F172A]/40 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">MT5 Execution History</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4">Action</th>
                        <th className="px-6 py-4">Asset</th>
                        <th className="px-6 py-4">Entry</th>
                        <th className="px-6 py-4">Risk (SL/TP)</th>
                        <th className="px-6 py-4 text-center">MT5 Status</th>
                        <th className="px-6 py-4 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {signals.map((signal) => (
                        <tr key={signal.id} className="hover:bg-white/[0.03] transition-colors group">
                          <td className="px-6 py-4">
                            <span className={cn(
                              "font-black text-[10px] px-2 py-0.5 rounded",
                              signal.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                            )}>
                              {signal.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-black text-white text-[11px] tracking-tight">{signal.pair || 'EURUSD'}</td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{signal.entry_price.toFixed(5)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-bold text-rose-500/60 font-mono">SL: {signal.sl || '---'}</span>
                              <span className="text-[9px] font-bold text-emerald-500/60 font-mono">TP: {signal.tp || '---'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                              signal.executed_on_mt5 === 1 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                            )}>
                              {signal.executed_on_mt5 === 1 ? 'EJECUTADO' : 'PENDIENTE'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-[10px] text-slate-500">
                            {new Date(signal.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'contacts' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="bg-[#0F172A]/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl shadow-2xl">
                  <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest flex items-center gap-3">
                    <UserIcon className="text-rose-500" /> Soporte Técnico
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Telegram Support</p>
                      <p className="text-white font-bold">@AdberrySupport_Bot</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Email Corporativo</p>
                      <p className="text-white font-bold">support@adberry.quantum</p>
                    </div>
                  </div>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/20 p-8 rounded-3xl flex flex-col justify-center">
                  <p className="text-sm text-slate-300 leading-relaxed italic">
                    "Nuestro equipo de ingenieros está disponible 24/7 para asegurar que tu terminal Quantum opere con la máxima eficiencia y latencia mínima."
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'terms' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0F172A]/40 backdrop-blur-md border border-white/5 p-10 rounded-3xl shadow-2xl max-w-4xl mx-auto"
              >
                <h3 className="text-2xl font-black text-white mb-8 uppercase tracking-widest text-center">Términos y Condiciones</h3>
                <div className="space-y-6 text-slate-400 text-sm leading-relaxed">
                  <p>1. <strong className="text-white">Riesgo de Mercado:</strong> El trading de divisas conlleva un alto nivel de riesgo y puede no ser adecuado para todos los inversores. El apalancamiento crea riesgos adicionales.</p>
                  <p>2. <strong className="text-white">Uso del Software:</strong> Adberry Quantum es una herramienta de asistencia. El usuario es el único responsable de las decisiones tomadas y de la configuración de su cuenta MT5.</p>
                  <p>3. <strong className="text-white">Privacidad:</strong> Tus credenciales de MT5 se almacenan de forma segura y solo se utilizan para la ejecución automatizada de las señales que tú autorices.</p>
                  <p>4. <strong className="text-white">Limitación de Responsabilidad:</strong> Adberry no se hace responsable por pérdidas financieras derivadas de fallos técnicos, latencia de red o errores en el script de MT5.</p>
                </div>
              </motion.div>
            )}

            {activeTab === 'socials' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-6"
              >
                {[
                  { name: 'Instagram', handle: '@adberry.quantum', color: 'from-purple-600 to-pink-600' },
                  { name: 'Twitter / X', handle: '@AdberryQuantum', color: 'from-slate-800 to-slate-900' },
                  { name: 'Telegram Channel', handle: 't.me/AdberrySignals', color: 'from-blue-500 to-blue-600' },
                ].map((social, i) => (
                  <div key={i} className="bg-[#0F172A]/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl shadow-2xl group cursor-pointer hover:border-rose-500/30 transition-all">
                    <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-tr flex items-center justify-center mb-6 shadow-lg", social.color)}>
                      <Globe className="text-white" size={24} />
                    </div>
                    <h4 className="text-white font-black uppercase tracking-widest text-sm mb-1">{social.name}</h4>
                    <p className="text-rose-500 font-bold text-xs">{social.handle}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* MT5 Script Guide Modal */}
      <AnimatePresence>
        {showWebhookGuide && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWebhookGuide(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-[#0F172A] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-rose-500/5">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <Cpu size={22} className="text-rose-500" />
                  Configuración Script MT5 (Gratis)
                </h3>
                <button onClick={() => setShowWebhookGuide(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">Para conectar Adberry con MetaTrader 5, utiliza este script de Python. El script revisará automáticamente las señales y las ejecutará en tu cuenta.</p>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">1. Instala la librería</label>
                    <div className="bg-slate-900 p-3 rounded-xl border border-white/5">
                      <code className="text-xs text-rose-400 font-mono">pip install MetaTrader5 requests</code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">2. Script de Conexión (adberry_bridge.py)</label>
                    <div className="bg-slate-900 p-4 rounded-xl border border-white/5 relative group">
                      <pre className="text-[9px] text-emerald-400 font-mono leading-relaxed overflow-x-auto">
{`import MetaTrader5 as mt5
import requests
import time

# CONFIGURACIÓN
API_URL = "${APP_URL}"
ACCOUNT_ID = "${settings.mt5_account || 'TU_ID'}"

def execute_trade(signal):
    # Lógica de ejecución en MT5
    symbol = signal['pair']
    order_type = mt5.ORDER_TYPE_BUY if signal['type'] == 'BUY' else mt5.ORDER_TYPE_SELL
    price = mt5.symbol_info_tick(symbol).ask if signal['type'] == 'BUY' else mt5.symbol_info_tick(symbol).bid
    
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": 0.01, # El script puede leer el lotaje de la API
        "type": order_type,
        "price": price,
        "sl": signal['sl'],
        "tp": signal['tp'],
        "magic": 123456,
        "comment": "Adberry Quantum Signal",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    return result

while True:
    try:
        response = requests.get(f"{API_URL}/api/mt5/pending/{ACCOUNT_ID}")
        data = response.json()
        for signal in data['signals']:
            print(f"Ejecutando {signal['type']} en {signal['pair']}...")
            res = execute_trade(signal)
            if res.retcode == mt5.TRADE_RETCODE_DONE:
                requests.post(f"{API_URL}/api/mt5/confirm", json={"signal_id": signal['id']})
    except Exception as e:
        print(f"Error: {e}")
    time.sleep(5)`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-2xl flex gap-4 items-start">
                  <AlertCircle size={20} className="text-amber-500 shrink-0 mt-1" />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Asegúrate de tener MetaTrader 5 abierto y con la opción "Algo Trading" activada. El script debe correr en la misma PC donde está instalado MT5.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0F172A] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <Settings size={22} className="text-rose-500" />
                  Configuración Pro
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Lotaje por Señal</label>
                      <span className="text-rose-500 font-bold text-xs">{settings.lot_size} Lots</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.01" 
                      max="1.0" 
                      step="0.01"
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      value={settings.lot_size}
                      onChange={(e) => setSettings(prev => ({ ...prev, lot_size: parseFloat(e.target.value) }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Capital Operativo ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input 
                        type="number" 
                        className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-white focus:outline-none focus:border-rose-500/50 transition-all font-bold"
                        value={settings.capital}
                        onChange={(e) => setSettings(prev => ({ ...prev, capital: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="h-[1px] bg-white/5" />

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Credenciales MetaTrader 5</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ID de Cuenta</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-rose-500/50 transition-all font-mono text-sm"
                        placeholder="Ej: 12345678"
                        value={settings.mt5_account}
                        onChange={(e) => setSettings(prev => ({ ...prev, mt5_account: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Servidor MT5</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-rose-500/50 transition-all font-mono text-sm"
                        placeholder="Ej: MetaQuotes-Demo"
                        value={settings.mt5_server}
                        onChange={(e) => setSettings(prev => ({ ...prev, mt5_server: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña MT5</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="password" 
                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-rose-500/50 transition-all font-mono text-sm"
                        placeholder="••••••••"
                        value={settings.mt5_password}
                        onChange={(e) => setSettings(prev => ({ ...prev, mt5_password: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-rose-500/5 border border-rose-500/20 p-6 rounded-2xl flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <ShieldCheck size={20} className="text-rose-500 shrink-0 mt-1" />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Tus credenciales se utilizan únicamente para que el script gratuito de MT5 pueda conectar y ejecutar las señales de Adberry.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={saveSettings}
                  disabled={isLoading}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-rose-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isLoading ? 'GUARDANDO...' : 'APLICAR CONFIGURACIÓN MT5'}
                  {!isLoading && <ChevronRight size={18} />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
