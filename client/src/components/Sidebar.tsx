import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { OngLogo } from './OngLogo';
import { Clock, Send, Trash2, ChevronDown, LogOut } from 'lucide-react';

interface SidebarProps {
  user: User;
  activeTab: 'scheduled' | 'sent' | 'trash';
  onTabChange: (tab: 'scheduled' | 'sent' | 'trash') => void;
  onOpenCompose: () => void;
  onLogout: () => void;
  scheduledCount: number;
  sentCount: number;
  trashCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  onOpenCompose,
  onLogout,
  scheduledCount,
  sentCount,
  trashCount,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarSrc = user.avatarUrl || '/assets/oliver_brown.jpg';
  const displayName = user.displayName || 'Oliver Brown';
  const displayEmail = user.email || 'oliver.brown@domain.io';

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen shrink-0 select-none px-4 py-5 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Logo */}
      <div className="px-2 pt-1 pb-4">
        <OngLogo className="h-6 w-auto text-black" />
      </div>

      {/* User Profile Card */}
      <div className="relative mb-3.5" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="w-full bg-[#f8f9fa] hover:bg-[#f1f3f4] border border-gray-100/90 rounded-2xl p-2.5 flex items-center justify-between transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <img
              src={avatarSrc}
              alt={displayName}
              onError={(e) => {
                // Fallback to placeholder avatar if image fails to load
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
              }}
              className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-gray-200"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-semibold text-gray-900 truncate leading-tight">
                {displayName}
              </h3>
              <p className="text-[11px] text-gray-400 font-normal truncate leading-tight mt-0.5">
                {displayEmail}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 shrink-0 transition-transform ${
              menuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* User Dropdown Menu */}
        {menuOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3.5 py-2 border-b border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                Signed in as
              </p>
              <p className="text-xs font-medium text-gray-800 truncate">{displayEmail}</p>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="w-full px-3.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>

      {/* Compose Button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onOpenCompose}
          className="w-full border border-[#00a846] text-[#00a846] bg-white hover:bg-[#e7f6ec]/40 active:scale-[0.99] rounded-full py-2.5 px-4 text-sm font-semibold transition-all text-center flex items-center justify-center cursor-pointer shadow-none"
        >
          Compose
        </button>
      </div>

      {/* CORE Section Header */}
      <div className="px-3 mb-2">
        <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
          CORE
        </span>
      </div>

      {/* Navigation List */}
      <nav className="space-y-1">
        {/* Scheduled Tab */}
        <button
          type="button"
          onClick={() => onTabChange('scheduled')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
            activeTab === 'scheduled'
              ? 'bg-[#e7f6ec] text-gray-900 font-bold'
              : 'text-gray-600 hover:bg-gray-50 font-medium'
          }`}
        >
          <div className="flex items-center space-x-3">
            <Clock
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'scheduled' ? 'text-gray-900' : 'text-gray-500'
              }`}
            />
            <span>Scheduled</span>
          </div>
          <span
            className={`text-xs ${
              activeTab === 'scheduled'
                ? 'text-gray-700 font-semibold'
                : 'text-gray-400 font-normal'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        {/* Sent Tab */}
        <button
          type="button"
          onClick={() => onTabChange('sent')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
            activeTab === 'sent'
              ? 'bg-[#e7f6ec] text-gray-900 font-bold'
              : 'text-gray-600 hover:bg-gray-50 font-medium'
          }`}
        >
          <div className="flex items-center space-x-3">
            <Send
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'sent' ? 'text-gray-900' : 'text-gray-500'
              }`}
            />
            <span>Sent</span>
          </div>
          <span
            className={`text-xs ${
              activeTab === 'sent'
                ? 'text-gray-700 font-semibold'
                : 'text-gray-400 font-normal'
            }`}
          >
            {sentCount}
          </span>
        </button>

        {/* Trash Tab */}
        <button
          type="button"
          onClick={() => onTabChange('trash')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
            activeTab === 'trash'
              ? 'bg-[#fee2e2]/60 text-red-900 font-bold'
              : 'text-gray-600 hover:bg-gray-50 font-medium'
          }`}
        >
          <div className="flex items-center space-x-3">
            <Trash2
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'trash' ? 'text-red-700' : 'text-gray-500'
              }`}
            />
            <span>Trash</span>
          </div>
          <span
            className={`text-xs ${
              activeTab === 'trash'
                ? 'text-red-700 font-semibold'
                : 'text-gray-400 font-normal'
            }`}
          >
            {trashCount}
          </span>
        </button>
      </nav>
    </aside>
  );
};
