import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  QrCode, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  KeyRound, 
  ArrowRight, 
  UserCheck, 
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { copyToClipboard } from '../utils/clipboard';

export default function AuthModal({ isOpen, onClose, onShowToast }) {
  const { login, loginWithToken, isGuest, user } = useAuth();
  
  const [tab, setTab] = useState('login'); // 'login' | 'device' | 'signup'
  
  // Direct Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Device Code State
  const [deviceData, setDeviceData] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [deviceError, setDeviceError] = useState(null);
  const pollTimerRef = useRef(null);

  // Reset form states when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDeviceError(null);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  // Handle direct login
  const handleDirectLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your Seedr email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);
      onShowToast?.(`Signed in successfully as ${email.trim()}!`, 'success');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Invalid Seedr login credentials');
    } finally {
      setLoading(false);
    }
  };

  // Start Device Code Authentication Flow
  const fetchDeviceCode = async () => {
    setDeviceLoading(true);
    setDeviceError(null);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    try {
      const res = await api.post('/auth/device-code');
      setDeviceData(res.data);
      
      // Begin polling every 5 seconds
      const code = res.data.deviceCode;
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await api.post('/auth/device-token', { deviceCode: code });
          if (pollRes.data?.status === 'success' && pollRes.data.token) {
            clearInterval(pollTimerRef.current);
            loginWithToken(pollRes.data.token, pollRes.data.user);
            onShowToast?.(`Connected via Device Code successfully!`, 'success');
            onClose();
          }
        } catch (pollErr) {
          // If error occurs during poll, stop
          if (pollErr.response?.data?.error && pollErr.response.data.error !== 'authorization_pending') {
            clearInterval(pollTimerRef.current);
            setDeviceError(pollErr.response.data.error);
          }
        }
      }, 5000);

    } catch (err) {
      setDeviceError(err.response?.data?.error || 'Failed to start device linking.');
    } finally {
      setDeviceLoading(false);
    }
  };

  // Trigger device code fetch when user switches to 'device' tab
  useEffect(() => {
    if (isOpen && tab === 'device' && !deviceData && !deviceLoading) {
      fetchDeviceCode();
    }
  }, [isOpen, tab]);

  const handleCopyCode = async (code) => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-[#1E293B] rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1E293B] bg-slate-50/80 dark:bg-[#111927]">
          <div className="flex items-center gap-3">
            <div className="bg-[#00DF81]/10 text-[#00DF81] p-2.5 rounded-xl border border-[#00DF81]/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Seedr Account
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Connect your personal Seedr cloud or browse as Guest
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-[#1E293B] px-5 pt-3 gap-2 bg-slate-50/40 dark:bg-[#0B132B]/30">
          <button
            onClick={() => setTab('login')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 px-2 transition-all ${
              tab === 'login'
                ? 'border-[#00DF81] text-[#00DF81]'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Direct Log In
          </button>
          <button
            onClick={() => setTab('device')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 px-2 transition-all flex items-center gap-1.5 ${
              tab === 'device'
                ? 'border-[#00DF81] text-[#00DF81]'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Device Code (No Password)
          </button>
          <button
            onClick={() => setTab('signup')}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 px-2 transition-all flex items-center gap-1.5 ${
              tab === 'signup'
                ? 'border-[#00DF81] text-[#00DF81]'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Sign Up (Free)
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* TAB 1: Direct Log In */}
          {tab === 'login' && (
            <form onSubmit={handleDirectLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Seedr Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. user@gmail.com"
                    className="w-full bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00DF81] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Seedr Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00DF81] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Zero-Storage Assurance Banner */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Zero-Credential Storage:</strong> Your password is exchanged directly in-memory with Seedr's OAuth API. We do not store your password anywhere in any database or disk.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#00DF81] hover:bg-[#00DF81]/90 text-slate-950 font-bold rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#00DF81]/15"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting to Seedr...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Log In to My Seedr Account
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500">Don't have a Seedr account yet? </span>
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  className="text-xs font-bold text-[#00DF81] hover:underline"
                >
                  Create one for free
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Device Code Flow (No Password) */}
          {tab === 'device' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Connect without typing your password into this app:
                </p>

                {deviceLoading ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 text-[#00DF81] animate-spin" />
                    <p className="text-xs text-slate-400">Requesting verification code from Seedr...</p>
                  </div>
                ) : deviceData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-[#00DF81] bg-slate-900/10 dark:bg-black/30 px-4 py-2 rounded-xl border border-[#00DF81]/30">
                        {deviceData.userCode}
                      </span>
                      <button
                        onClick={() => handleCopyCode(deviceData.userCode)}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-[#1E293B] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy User Code"
                      >
                        {copiedCode ? <Check className="w-5 h-5 text-[#00DF81]" /> : <Copy className="w-5 h-5 text-slate-400" />}
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Step 1: Copy this code and open{' '}
                      <a 
                        href="https://www.seedr.cc/devices" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[#00DF81] font-bold underline inline-flex items-center gap-1"
                      >
                        seedr.cc/devices <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>

                    <a
                      href="https://www.seedr.cc/devices"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-sky-500/20"
                    >
                      Open Seedr Devices Page <ExternalLink className="w-4 h-4" />
                    </a>

                    <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-[#00DF81] animate-ping" />
                      <span>Waiting for code entry on Seedr.cc...</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={fetchDeviceCode}
                    className="py-2 px-4 bg-[#00DF81] text-slate-950 font-bold rounded-xl text-xs"
                  >
                    Generate Device Code
                  </button>
                )}

                {deviceError && (
                  <p className="text-xs text-rose-500 mt-2">{deviceError}</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Sign Up Walkthrough */}
          {tab === 'signup' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-transparent border border-amber-500/20 rounded-2xl p-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Free Seedr Account Setup
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Seedr provides 2.0 GB to 4.5 GB of free high-speed cloud storage for every registered user.
                </p>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-[#00DF81]/20 text-[#00DF81] font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-white mb-0.5">Register on Seedr.cc</strong>
                    <span>Click the button below to open the official Seedr signup page in a new tab.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-[#00DF81]/20 text-[#00DF81] font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-white mb-0.5">Verify your email address</strong>
                    <span>Seedr will send a confirmation email. Click <em>"Activate Seedr"</em> to unlock your free storage.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#090F1C] border border-slate-200 dark:border-[#1E293B] rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-[#00DF81]/20 text-[#00DF81] font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-white mb-0.5">Log in here!</strong>
                    <span>Come back to this app and sign in. Your personal files and quota will appear immediately.</span>
                  </div>
                </div>
              </div>

              <a
                href="https://www.seedr.cc/"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-[#00DF81] hover:bg-[#00DF81]/90 text-slate-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00DF81]/15"
              >
                Open Seedr.cc Sign Up <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => setTab('login')}
                className="w-full text-center text-xs text-[#00DF81] hover:underline font-semibold"
              >
                Already have an account? Go to Log In
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

