import React, { useState } from 'react';
import { EmailItem, User } from '../types';
import {
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

interface EmailDetailProps {
  email: EmailItem;
  user: User;
  onBack: () => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
}

export const EmailDetail: React.FC<EmailDetailProps> = ({
  email,
  user,
  onBack,
  onDelete,
  onRestore,
  onPermanentDelete,
}) => {
  const [isStarred, setIsStarred] = useState(false);

  // Sender details
  const senderName = email.sender.includes('@')
    ? email.sender.split('@')[0]
    : email.sender;
  const initial = (senderName.charAt(0) || 'A').toUpperCase();

  // If body doesn't contain rich HTML/formatting, parse paragraphs or show formatted demo
  const isAmandaEmail =
    email.subject.includes('MJWYT44') ||
    email.sender.includes('Amanda') ||
    email.body.includes('RECEIVED something');

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Action Bar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center space-x-3.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="Back to email list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
            {email.subject}
          </h1>
        </div>

        {email.deletedAt ? (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => onRestore && onRestore(email.id)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
              title="Restore to active view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>
            <button
              type="button"
              onClick={() => onPermanentDelete && onPermanentDelete(email.id)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              title="Permanently delete from database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently</span>
            </button>
            <img
              src={user.avatarUrl || '/assets/oliver_brown.jpg'}
              alt={user.displayName || 'User'}
              className="w-6 h-6 rounded-full object-cover ml-2 ring-1 ring-gray-200"
            />
          </div>
        ) : (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsStarred((prev) => !prev)}
              className="p-1.5 text-gray-400 hover:text-amber-400 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title="Star email"
            >
              <Star
                className={`w-4 h-4 ${
                  isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-400'
                }`}
              />
            </button>
            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete && onDelete(email.id)}
              className="p-1.5 text-gray-400 hover:text-rose-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title="Move to trash"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <img
              src={user.avatarUrl || '/assets/oliver_brown.jpg'}
              alt={user.displayName || 'User'}
              className="w-6 h-6 rounded-full object-cover ml-2 ring-1 ring-gray-200"
            />
          </div>
        )}
      </div>

      {/* Main Email Reading View */}
      <div className="flex-1 overflow-y-auto px-8 sm:px-14 py-8">
        {/* Trash Banner if in trash */}
        {email.deletedAt && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-amber-800">
              <span className="font-semibold">This email is in Trash.</span>
              <span className="text-amber-600">
                Deleted on {new Date(email.deletedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onRestore && onRestore(email.id)}
                className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Restore
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => onPermanentDelete && onPermanentDelete(email.id)}
                className="text-xs font-semibold text-rose-700 hover:underline cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        )}

        {/* Sender Info Line */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center space-x-3.5">
            {/* Green Circular Initial Avatar */}
            <div className="w-9 h-9 rounded-full bg-[#00a846] text-white flex items-center justify-center font-bold text-sm shrink-0">
              {initial}
            </div>

            <div>
              <div className="flex items-baseline space-x-2">
                <span className="font-bold text-sm text-gray-900">{senderName}</span>
                <span className="text-xs text-gray-400 font-normal">
                  &lt;{email.sender}&gt;
                </span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-gray-400 mt-0.5">
                <span>to me</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-400 font-normal">
            Nov 3, 10:23 AM
          </div>
        </div>

        {/* Email Body Content */}
        {isAmandaEmail ? (
          <div className="space-y-4 text-sm text-gray-800 leading-relaxed max-w-2xl">
            <p>Hey Oliver,</p>
            <p>You&apos;ve just RECEIVED something</p>

            {/* Callout Box */}
            <div className="bg-[#fefce8] border-l-4 border-amber-400 p-4 rounded-r-xl my-5">
              <p className="font-bold text-gray-900 text-sm flex items-center space-x-1.5">
                <span>⚡</span>
                <span>Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment</span>
                <span>⚡</span>
              </p>
              <p className="text-xs text-gray-700 mt-1 flex items-center space-x-1.5">
                <span>✦</span>
                <span>To explore securing your private transformation, simply reply right now with &quot;FLY OUT FIX&quot;</span>
              </p>
            </div>

            <p>Your coach for world-class performance,</p>
            <p className="font-medium text-gray-900">Grant</p>

            <p className="text-gray-500 italic text-xs pt-2">
              P.S. Always remember that you can develop world class technique! 🚀
            </p>

            {/* Attachments Section */}
            <div className="pt-8 flex flex-wrap gap-4">
              {/* Attachment 1 */}
              <div className="w-56 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow cursor-pointer">
                <div className="h-28 bg-slate-100 overflow-hidden">
                  <img
                    src="/assets/tennis_coach_profile.jpg"
                    alt="Tennis Coach Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 bg-white">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    Tennis_Coach_Profile.png
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">1.2 MB</p>
                </div>
              </div>

              {/* Attachment 2 */}
              <div className="w-56 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow cursor-pointer">
                <div className="h-28 bg-slate-100 overflow-hidden">
                  <img
                    src="/assets/tennis_coach_profile.jpg"
                    alt="Tennis Coach Profile 2"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 bg-white">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    Tennis_Coach_Profile2.png
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">1.2 MB</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm text-gray-800 leading-relaxed max-w-2xl whitespace-pre-line">
            <p className="text-base text-gray-900 font-semibold mb-2">{email.subject}</p>
            <p>{email.body}</p>
          </div>
        )}
      </div>
    </div>
  );
};
