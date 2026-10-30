import React, { useState } from 'react';
import { EmailItem } from '../types';
import { Search, Filter, RotateCw, Clock, Star, Trash2, RotateCcw } from 'lucide-react';

interface EmailListProps {
  emails: EmailItem[];
  activeTab: 'scheduled' | 'sent' | 'trash';
  onSelectEmail: (email: EmailItem) => void;
  onRefresh: () => void;
  loading: boolean;
  onRestore?: (email: EmailItem, e: React.MouseEvent) => void;
  onPermanentDelete?: (email: EmailItem, e: React.MouseEvent) => void;
  onEmptyTrash?: () => void;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  activeTab,
  onSelectEmail,
  onRefresh,
  loading,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>({});

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filter based on active tab and search query
  const filteredEmails = emails.filter((email) => {
    if (activeTab === 'trash') {
      if (!email.deletedAt) return false;
    } else {
      if (email.deletedAt) return false;
      const isScheduledTab = activeTab === 'scheduled';
      const matchesTab = isScheduledTab
        ? email.status === 'SCHEDULED' || email.status === 'PROCESSING'
        : email.status === 'SENT';

      if (!matchesTab) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      email.recipient.toLowerCase().includes(q) ||
      email.subject.toLowerCase().includes(q) ||
      email.body.toLowerCase().includes(q)
    );
  });

  const formatScheduledTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const timePart = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      return `${dayName} ${timePart}`;
    } catch {
      return dateStr;
    }
  };

  const formatDeletedDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white select-none">
      {/* Top Header / Search Bar */}
      <div className="px-8 pt-5 pb-4 flex items-center space-x-4 border-b border-gray-100">
        {/* Search Pill Input */}
        <div className="flex-1 max-w-xl relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'trash' ? 'Search trash' : 'Search'}
            className="w-full pl-10 pr-4 py-2 bg-[#f3f5f4] hover:bg-[#eef1f0] focus:bg-white text-gray-800 placeholder:text-gray-400 text-sm rounded-full border border-transparent focus:border-gray-200 focus:outline-none transition-all"
          />
        </div>

        {/* Empty Trash Button (when on Trash tab) */}
        {activeTab === 'trash' && onEmptyTrash && (
          <button
            type="button"
            onClick={onEmptyTrash}
            title="Empty entire trash"
            disabled={filteredEmails.length === 0}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:hover:bg-rose-50 rounded-full border border-rose-200 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Empty Trash</span>
          </button>
        )}

        {/* Filter (Funnel) Button */}
        <button
          type="button"
          title="Filter emails"
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <Filter className="w-4 h-4" />
        </button>

        {/* Refresh Circular Button */}
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh emails"
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Email List Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <p className="text-sm font-medium text-gray-500">
              {searchQuery
                ? `No emails match "${searchQuery}"`
                : activeTab === 'scheduled'
                ? 'No scheduled emails in your queue'
                : activeTab === 'sent'
                ? 'No sent emails found'
                : 'Trash is empty'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {activeTab === 'trash'
                ? 'Deleted emails will be kept here until permanently deleted or emptied.'
                : 'Click Compose on the sidebar to create and schedule your next email.'}
            </p>
          </div>
        ) : (
          filteredEmails.map((email) => {
            const isStarred = Boolean(starredIds[email.id]);
            const recipientLabel = email.recipient.includes('@')
              ? email.recipient.split('@')[0]
              : email.recipient;

            return (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className="px-8 py-3.5 flex items-center hover:bg-[#fbfcfb] transition-colors cursor-pointer group"
              >
                {/* Column 1: Recipient (To: Name) */}
                <div className="w-48 sm:w-56 shrink-0 truncate pr-4">
                  <span className="text-sm text-gray-500 font-normal">To: </span>
                  <span className="text-sm font-bold text-gray-900 capitalize">
                    {recipientLabel}
                  </span>
                </div>

                {/* Column 2: Status Pill */}
                <div className="shrink-0 mr-4 flex items-center space-x-2">
                  {activeTab === 'scheduled' ? (
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#fff1e5] text-[#d95c14] text-xs font-medium">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-[#d95c14]" />
                      <span>{formatScheduledTime(email.scheduledAt)}</span>
                    </div>
                  ) : activeTab === 'sent' ? (
                    <div className="inline-flex items-center px-3 py-0.5 rounded-full bg-[#f0f2f1] text-gray-600 text-xs font-medium">
                      Sent
                    </div>
                  ) : (
                    <>
                      <div
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          email.status === 'SENT'
                            ? 'bg-[#f0f2f1] text-gray-600'
                            : 'bg-[#fff1e5] text-[#d95c14]'
                        }`}
                      >
                        {email.status}
                      </div>
                      {email.deletedAt && (
                        <div className="text-[11px] text-gray-400 font-normal">
                          Deleted {formatDeletedDate(email.deletedAt)}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Column 3: Subject + Snippet */}
                <div className="flex-1 min-w-0 pr-4 flex items-baseline truncate">
                  <span className="text-sm font-semibold text-gray-900 shrink-0">
                    {email.subject}
                  </span>
                  <span className="text-sm text-gray-400 font-normal truncate ml-1.5">
                    - {email.body.replace(/\n+/g, ' ')}
                  </span>
                </div>

                {/* Column 4: Row Actions */}
                {activeTab === 'trash' ? (
                  <div className="shrink-0 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={(e) => onRestore && onRestore(email, e)}
                      title="Restore email"
                      className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => onPermanentDelete && onPermanentDelete(email, e)}
                      title="Delete permanently"
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => toggleStar(email.id, e)}
                    className="shrink-0 p-1 text-gray-300 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                      }`}
                    />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
