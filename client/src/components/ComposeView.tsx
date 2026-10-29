import React, { useState } from 'react';
import { ComposeEmailPayload, User } from '../types';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  ChevronDown,
  Calendar,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  ListOrdered,
  List,
  Indent,
  Outdent,
  Quote,
  Image as ImageIcon,
  Link as LinkIcon,
  Upload,
} from 'lucide-react';

interface ComposeViewProps {
  user: User;
  onBack: () => void;
  onSubmit: (payload: ComposeEmailPayload) => Promise<void>;
}

export const ComposeView: React.FC<ComposeViewProps> = ({
  user,
  onBack,
  onSubmit,
}) => {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayBetween, setDelayBetween] = useState('00');
  const [hourlyLimit, setHourlyLimit] = useState('00');

  // Attachments toggle
  const [hasAttachment, setHasAttachment] = useState(false);

  // Send Later Popover state
  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);
  const [scheduledDateStr, setScheduledDateStr] = useState<string>('');
  const [scheduledDisplay, setScheduledDisplay] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle Preset Selection in Send Later Popover
  const handleSelectPreset = (preset: string) => {
    const target = new Date();
    target.setDate(target.getDate() + 1); // Tomorrow

    if (preset === 'Tomorrow, 10:00 AM') {
      target.setHours(10, 0, 0, 0);
    } else if (preset === 'Tomorrow, 11:00 AM') {
      target.setHours(11, 0, 0, 0);
    } else if (preset === 'Tomorrow, 3:00 PM') {
      target.setHours(15, 0, 0, 0);
    } else {
      // Default Tomorrow 9:00 AM
      target.setHours(9, 0, 0, 0);
    }

    setScheduledDateStr(target.toISOString());
    setScheduledDisplay(preset);
  };

  const handleCustomDateTime = (val: string) => {
    if (!val) return;
    const date = new Date(val);
    setScheduledDateStr(date.toISOString());
    setScheduledDisplay(
      date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    );
  };

  const handleSend = async () => {
    if (!recipient.trim()) {
      setErrorMsg('Please enter a recipient email.');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Please enter an email subject.');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Please enter an email body.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // Default to 10 seconds in future if no schedule date chosen
      const scheduledAt =
        scheduledDateStr || new Date(Date.now() + 10 * 1000).toISOString();

      await onSubmit({
        recipient: recipient.trim(),
        subject: subject.trim(),
        body: body.trim(),
        scheduledAt,
      });

      onBack();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to schedule email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userEmail = user.email || 'oliver.brown@domain.io';

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white select-none font-['Plus_Jakarta_Sans',sans-serif] relative">
      {/* Top Header Bar */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 text-gray-700 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            Compose New Email
          </h1>
        </div>

        {/* Right Action Icons & Send Button */}
        <div className="flex items-center space-x-4">
          {/* Paperclip Attachment Toggle */}
          <button
            type="button"
            onClick={() => setHasAttachment((prev) => !prev)}
            title="Attach file"
            className="relative p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
            {hasAttachment && (
              <span className="absolute -top-1 -right-1 bg-[#00a846] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                1
              </span>
            )}
          </button>

          {/* Clock Icon (Toggles Send Later Popover) */}
          <button
            type="button"
            onClick={() => setIsSendLaterOpen((prev) => !prev)}
            title="Schedule email"
            className={`p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer ${
              isSendLaterOpen || scheduledDateStr
                ? 'text-[#00a846] bg-[#e7f6ec]/50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Green Outlined Send / Send Later Pill Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isSubmitting}
            className="border border-[#00a846] text-[#00a846] bg-white hover:bg-[#e7f6ec]/40 active:scale-[0.99] font-medium text-sm px-6 py-1.5 rounded-full transition-all cursor-pointer shadow-none flex items-center space-x-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Sending...</span>
            ) : scheduledDateStr ? (
              <span>Send Later</span>
            ) : (
              <span>Send</span>
            )}
          </button>
        </div>
      </div>

      {/* Send Later Floating Popover Modal (Screenshot 4) */}
      {isSendLaterOpen && (
        <div className="absolute top-16 right-8 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 z-50 animate-in fade-in zoom-in-95 duration-150">
          <h3 className="font-bold text-sm text-gray-900 mb-4">Send Later</h3>

          {/* Date & Time Picker */}
          <div className="relative mb-4">
            <input
              type="datetime-local"
              onChange={(e) => handleCustomDateTime(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-xs text-gray-700 border border-gray-200 rounded-xl focus:outline-none focus:border-[#00a846] transition-colors"
            />
            <Calendar className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5 mb-6">
            {['Tomorrow', 'Tomorrow, 10:00 AM', 'Tomorrow, 11:00 AM', 'Tomorrow, 3:00 PM'].map(
              (preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    scheduledDisplay === preset
                      ? 'bg-[#e7f6ec] text-[#00a846] font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {preset}
                </button>
              )
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setScheduledDateStr('');
                setScheduledDisplay('');
                setIsSendLaterOpen(false);
              }}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsSendLaterOpen(false)}
              className="border border-[#00a846] text-[#00a846] hover:bg-[#e7f6ec] rounded-full px-5 py-1 text-xs font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Form Fields Container */}
      <div className="flex-1 overflow-y-auto px-8 sm:px-14 py-6">
        {errorMsg && (
          <div className="mb-4 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* From Row */}
        <div className="flex items-center py-2.5">
          <span className="w-20 text-sm text-gray-500 font-normal">From</span>
          <div className="bg-[#f3f4f6] text-gray-800 text-xs font-medium px-3.5 py-1.5 rounded-xl inline-flex items-center space-x-2">
            <span>{userEmail}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </div>
        </div>

        {/* To Row */}
        <div className="flex items-center py-2.5 border-b border-gray-100">
          <span className="w-20 text-sm text-gray-500 font-normal">To</span>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none border-0 p-0"
          />
          <button
            type="button"
            onClick={() => setRecipient('recipient@example.com')}
            className="text-[#00a846] text-xs font-semibold flex items-center space-x-1 hover:underline cursor-pointer ml-3"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload List</span>
          </button>
        </div>

        {/* Subject Row */}
        <div className="flex items-center py-2.5 border-b border-gray-100">
          <span className="w-20 text-sm text-gray-500 font-normal">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none border-0 p-0"
          />
        </div>

        {/* Extra Controls Row: Delay between 2 emails & Hourly Limit */}
        <div className="flex items-center space-x-8 py-3.5">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-700 font-semibold">
              Delay between 2 emails
            </span>
            <input
              type="text"
              value={delayBetween}
              onChange={(e) => setDelayBetween(e.target.value)}
              className="w-14 h-8 text-center text-xs text-gray-700 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#00a846]"
            />
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-700 font-semibold">
              Hourly Limit
            </span>
            <input
              type="text"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              className="w-14 h-8 text-center text-xs text-gray-700 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#00a846]"
            />
          </div>
        </div>

        {/* Rich Editor Canvas Area */}
        <div className="bg-[#fafafa] border border-gray-100 rounded-2xl p-6 min-h-[360px] flex flex-col justify-between mt-2">
          {/* Text Area */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            rows={10}
            className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none resize-none"
          />

          {/* Attachment Preview Card if Attached (Screenshot 5) */}
          {hasAttachment && (
            <div className="pt-4 border-t border-gray-100/80 mb-2">
              <div className="w-40 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <img
                  src="/assets/tennis_coach_profile.jpg"
                  alt="Attachment Preview"
                  className="w-full h-24 object-cover"
                />
              </div>
            </div>
          )}

          {/* Floating Rich Text Formatting Toolbar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3.5 py-1.5 flex items-center space-x-3.5 text-gray-500 text-xs w-fit select-none">
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Undo">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Redo">
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            <div className="h-3.5 w-px bg-gray-200" />

            <div className="flex items-center space-x-0.5 hover:text-gray-800 cursor-pointer font-serif">
              <span>Tt</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </div>

            <button type="button" className="hover:text-gray-800 cursor-pointer font-bold" title="Bold">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Italic">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Underline">
              <Underline className="w-3.5 h-3.5" />
            </button>

            <div className="h-3.5 w-px bg-gray-200" />

            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Align">
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Ordered List">
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Bullet List">
              <List className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Outdent">
              <Outdent className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Indent">
              <Indent className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Quote">
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setHasAttachment(true)}
              className="hover:text-gray-800 cursor-pointer"
              title="Insert Image"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="hover:text-gray-800 cursor-pointer" title="Insert Link">
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
