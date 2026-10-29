import React, { useState } from 'react';
import { EmailItem, EmailStatus } from '../types';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Calendar,
  Send,
  Inbox,
} from 'lucide-react';

interface EmailTableProps {
  emails: EmailItem[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCompose: () => void;
}

export const EmailTable: React.FC<EmailTableProps> = ({
  emails,
  loading,
  onRefresh,
  onOpenCompose,
}) => {
  const [activeTab, setActiveTab] = useState<'SCHEDULED' | 'SENT' | 'ALL'>('SCHEDULED');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter emails by active tab and search query
  const filteredEmails = emails.filter((item) => {
    const matchesTab =
      activeTab === 'ALL'
        ? true
        : activeTab === 'SCHEDULED'
        ? item.status === 'SCHEDULED' || item.status === 'PROCESSING'
        : item.status === 'SENT';

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.recipient.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query) ||
      item.body.toLowerCase().includes(query);

    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: EmailStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            Scheduled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('SCHEDULED')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'SCHEDULED'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scheduled Emails (
            {emails.filter((e) => e.status === 'SCHEDULED' || e.status === 'PROCESSING').length}
            )
          </button>
          <button
            onClick={() => setActiveTab('SENT')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'SENT'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sent Emails ({emails.filter((e) => e.status === 'SENT').length})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({emails.length})
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipient or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
            />
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh emails list"
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <th className="py-3.5 px-6">Recipient</th>
              <th className="py-3.5 px-6">Subject & Preview</th>
              <th className="py-3.5 px-6">
                {activeTab === 'SENT' ? 'Sent Time' : 'Scheduled Delivery Time'}
              </th>
              <th className="py-3.5 px-6">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading && emails.length === 0 ? (
              // Skeleton loading rows
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-6">
                    <div className="h-4 bg-slate-200 rounded w-40" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-4 bg-slate-200 rounded w-56 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-44" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-4 bg-slate-200 rounded w-32" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-5 bg-slate-200 rounded-full w-20" />
                  </td>
                </tr>
              ))
            ) : filteredEmails.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                    <Inbox className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">
                    {searchQuery
                      ? 'No matching emails found'
                      : activeTab === 'SCHEDULED'
                      ? 'No scheduled emails in queue'
                      : 'No sent emails yet'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? 'Try adjusting your search terms or clearing the filter.'
                      : 'Schedule an email now to test BullMQ delayed queue and Ethereal delivery.'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={onOpenCompose}
                      className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm shadow-indigo-200"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Compose First Email</span>
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              // Populated email rows
              filteredEmails.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="py-4 px-6 font-medium text-slate-800">
                    <div className="font-mono text-xs text-indigo-700">{item.recipient}</div>
                    <div className="text-[11px] text-slate-400">
                      From: {item.sender || 'You'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {item.subject}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-1 max-w-md">
                      {item.body}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-xs text-slate-600 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(item.scheduledAt)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Created: {formatDate(item.createdAt)}
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    {getStatusBadge(item.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
