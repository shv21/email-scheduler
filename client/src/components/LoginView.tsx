import React, { useState } from 'react';
import { Mail, Clock, Shield, ArrowRight, Zap, Database, Server } from 'lucide-react';

interface LoginViewProps {
  onDevLogin: () => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onDevLogin }) => {
  const [devLoading, setDevLoading] = useState(false);

  const handleDevLogin = async () => {
    try {
      setDevLoading(true);
      await onDevLogin();
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-500/25 mb-4">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">EmailScheduler</h2>
        <p className="mt-2 text-sm text-slate-400">
          Full-Stack Delayed Email Dispatcher with BullMQ & PostgreSQL
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-slate-700/60 sm:px-10">
          <div className="space-y-4">
            {/* Real Google OAuth Button */}
            <a
              href="/api/auth/google"
              className="w-full flex items-center justify-center px-4 py-3 border border-slate-600 rounded-xl shadow-sm text-sm font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-all active:scale-[0.98] group"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
              <ArrowRight className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </a>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-3 text-slate-400 font-mono">or test locally</span>
              </div>
            </div>

            {/* Dev Login Button */}
            <button
              onClick={handleDevLogin}
              disabled={devLoading}
              className="w-full flex items-center justify-center px-4 py-3 border border-indigo-500/30 rounded-xl text-sm font-semibold text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/40 transition-all active:scale-[0.98]"
            >
              <Zap className="w-4 h-4 mr-2 text-indigo-400" />
              <span>{devLoading ? 'Signing in...' : 'Quick Dev Login (Local Test)'}</span>
            </button>
            <p className="text-xs text-center text-slate-500 mt-2">
              Bypasses Google consent screen for rapid local testing without credentials.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="mt-8 pt-6 border-t border-slate-700/60 grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>BullMQ Delayed Queue</span>
            </div>
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>PostgreSQL & Prisma</span>
            </div>
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Redis Rate Limiter</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Passport Google OAuth</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
