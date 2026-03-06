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
  const [settings, setSettings] = useState({ lot_size: 0.01, capital: 1000 });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [botStatus, setBotStatus] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('adberry_user', JSON.stringify(user));
      fetchData();
      checkBotStatus();
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

  const checkBotStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      const data = await res.json();
      setBotStatus(data.connected);
    } catch (err) {}
  };

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setUser(prev => ({ ...prev, ...data }));
        setSettings({ lot_size: data.lot_size, capital: data.capital });
      }
    } catch (err) {}
  };

  const fetchData = async () => {
    if (!user) return;
    try {
      const sigRes = await fetch(`/api/user/${user.id}/signals`);
      const sigData = await sigRes.json();
      setSignals(sigData);
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
        setSettings({ lot_size: data.lot_size, capital: data.capital });
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
              <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-rose-500/40 rotate-3">
                <TrendingUp className="text-white" size={40} />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tighter" translate="no">ADBERRY</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="h-[1px] w-4 bg-rose-500/50" />
                <p className="text-rose-500 font-bold text-xs uppercase tracking-[0.3em]">Signals Pro</p>
                <span className="h-[1px] w-4 bg-rose-500/50" />
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
      <header className="h-20 bg-[#0F172A]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
            <TrendingUp className="text-white" size={20} />
          </div>
          <div>
            <span className="font-black text-xl tracking-tighter text-white block leading-none" translate="no">ADBERRY</span>
            <span className="text-[8px] font-black text-rose-500 uppercase tracking-[0.3em]">Signals Pro</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", botStatus ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500")} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Bot: {botStatus ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-2 pr-4 rounded-xl border border-white/5 transition-all"
            >
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-rose-500">
                <Menu size={16} />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-white leading-none mb-1">Menú Principal</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest font-black">Navegación & Ajustes</p>
              </div>
              <ChevronDown size={14} className={cn("text-slate-500 transition-transform", isMenuOpen && "rotate-180")} />
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
                    { label: 'Capital Total', value: `$${settings.capital.toLocaleString()}`, icon: DollarSign, color: 'rose' },
                    { label: 'Beneficio Total', value: `$${totalProfit.toFixed(2)}`, icon: TrendingUp, color: 'emerald' },
                    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, icon: Percent, color: 'blue' },
                    { label: 'Lote Actual', value: settings.lot_size, icon: Zap, color: 'amber' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#0F172A] border border-white/5 p-6 rounded-3xl relative overflow-hidden group shadow-xl">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", `bg-${stat.color}-500/10 text-${stat.color}-500`)}>
                          <stat.icon size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                          <p className="text-2xl font-black text-white tracking-tighter">{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Chart Section */}
                  <div className="lg:col-span-2 bg-[#0F172A] border border-white/5 p-8 rounded-[2.5rem] shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-black text-white flex items-center gap-3">
                        <BarChart3 size={20} className="text-rose-500" />
                        Rendimiento en Tiempo Real
                      </h3>
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
                  <div className="bg-[#0F172A] border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex flex-col">
                    <h3 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                      <Bell size={20} className="text-rose-500" />
                      Monitor Live
                    </h3>
                    <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                      {signals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-20 text-center">
                          <Activity size={40} className="mb-4" />
                          <p className="text-sm italic">Esperando señales...</p>
                        </div>
                      ) : (
                        signals.slice(0, 5).map((signal) => (
                          <div key={signal.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px]",
                                signal.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                              )}>
                                {signal.type}
                              </div>
                              <div>
                                <p className="font-bold text-white text-xs leading-none mb-1">EURUSD</p>
                                <p className="text-[10px] text-slate-500 font-bold">@{signal.entry_price.toFixed(4)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={cn(
                                "text-[8px] font-black px-2 py-1 rounded-md uppercase",
                                signal.status === 'OPEN' ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'
                              )}>
                                {signal.status}
                              </span>
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
                className="bg-[#0F172A] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-xl"
              >
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                  <h3 className="text-xl font-black text-white">Historial de Operaciones</h3>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-emerald-500/10 rounded-xl text-emerald-500 text-[10px] font-black border border-emerald-500/20">
                      PROFIT: +${totalProfit.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">
                        <th className="px-8 py-5">Tipo</th>
                        <th className="px-8 py-5">Símbolo</th>
                        <th className="px-8 py-5">Entrada</th>
                        <th className="px-8 py-5">SL / TP</th>
                        <th className="px-8 py-5">Beneficio</th>
                        <th className="px-8 py-5">Estado</th>
                        <th className="px-8 py-5">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {signals.map((signal) => (
                        <tr key={signal.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-8 py-5">
                            <span className={cn(
                              "font-black text-xs",
                              signal.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {signal.type}
                            </span>
                          </td>
                          <td className="px-8 py-5 font-bold text-white text-sm">EURUSD</td>
                          <td className="px-8 py-5 font-mono text-xs text-slate-400">{signal.entry_price.toFixed(5)}</td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-rose-500/60">SL: {signal.sl || 'N/A'}</span>
                              <span className="text-[10px] font-bold text-emerald-500/60">TP: {signal.tp || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "font-bold text-sm",
                              (signal.profit || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {(signal.profit || 0) > 0 ? '+' : ''}{(signal.profit || 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-[8px] font-black uppercase",
                              signal.status === 'OPEN' ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'
                            )}>
                              {signal.status}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase",
                              signal.result === 'WIN' ? 'bg-emerald-500/10 text-emerald-500' : 
                              signal.result === 'LOSS' ? 'bg-rose-500/10 text-rose-500' : 'bg-white/5 text-slate-500'
                            )}>
                              {signal.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

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
              
              <div className="p-8 space-y-8">
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

                <div className="bg-rose-500/5 border border-rose-500/20 p-6 rounded-2xl flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <ShieldCheck size={20} className="text-rose-500 shrink-0 mt-1" />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Los cambios en el lotaje afectarán a las próximas señales recibidas. El capital operativo se sincroniza automáticamente con TradingView.
                    </p>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/test/signal', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ user_id: user.id })
                        });
                        if (res.ok) alert('Señal de prueba enviada');
                      } catch (err) {
                        alert('Error al enviar señal de prueba');
                      }
                    }}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all"
                  >
                    Enviar Señal de Prueba
                  </button>
                </div>

                <button 
                  onClick={saveSettings}
                  disabled={isLoading}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-rose-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isLoading ? 'GUARDANDO...' : 'APLICAR CAMBIOS'}
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
