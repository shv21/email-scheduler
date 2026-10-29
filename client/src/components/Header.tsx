import React from 'react';
import { User } from '../types';
import { LogOut, Plus, Mail, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenCompose: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onOpenCompose }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">EmailScheduler</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                BullMQ Ready
              </span>
            </div>
            <p className="text-xs text-slate-500">PostgreSQL + Redis Delayed Dispatcher</p>
          </div>
        </div>

        {/* Actions & User Profile */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onOpenCompose}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition-all shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Email</span>
          </button>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* User info */}
          <div className="flex items-center space-x-3 pl-1">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName || user.email}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-100"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                {(user.displayName || user.email)[0].toUpperCase()}
              </div>
            )}
            <div className="hidden md:block text-left">
              <div className="text-sm font-semibold text-slate-800 flex items-center space-x-1">
                <span>{user.displayName || 'Authenticated User'}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-xs text-slate-500 font-mono">{user.email}</div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Log out"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
