import React, { useEffect, useState, useCallback } from 'react';
import { User, EmailItem, ComposeEmailPayload } from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { StatsCards } from './components/StatsCards';
import { EmailTable } from './components/EmailTable';
import { ComposeModal } from './components/ComposeModal';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // 1. Check user authentication status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        setAuthLoading(true);
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.warn('User not authenticated:', err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Fetch authenticated user's emails
  const loadEmails = useCallback(async () => {
    if (!user) return;
    try {
      setEmailsLoading(true);
      const items = await api.getEmails();
      setEmails(items);
    } catch (err: unknown) {
      console.error('Error fetching emails:', err);
    } finally {
      setEmailsLoading(false);
    }
  }, [user]);

  // Load emails when user logs in and set auto-refresh interval
  useEffect(() => {
    if (user) {
      loadEmails();
      // Poll every 8 seconds so status changes (SCHEDULED -> SENT) update live
      const interval = setInterval(loadEmails, 8000);
      return () => clearInterval(interval);
    }
  }, [user, loadEmails]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      setEmails([]);
      showNotification('success', 'Logged out successfully');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Logout failed');
    }
  };

  // Handle Dev / Email Login
  const handleDevLogin = async (email?: string) => {
    try {
      const devUser = await api.devLogin(email);
      setUser(devUser);
      showNotification('success', `Signed in as ${devUser.displayName}`);
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Login failed');
    }
  };

  // Handle Submit Scheduled Email
  const handleScheduleEmail = async (payload: ComposeEmailPayload) => {
    const created = await api.scheduleEmail(payload);
    // Prepend to email list immediately
    setEmails((prev) => [created, ...prev]);
    showNotification(
      'success',
      `Email to ${created.recipient} scheduled for ${new Date(created.scheduledAt).toLocaleTimeString()}`
    );
  };

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated State
  if (!user) {
    return <LoginView onDevLogin={handleDevLogin} />;
  }

  // Authenticated Dashboard
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        onOpenCompose={() => setIsComposeOpen(true)}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              notification.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700 backdrop-blur'
                : 'bg-rose-900/90 text-rose-100 border-rose-700 backdrop-blur'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Email Dispatch Dashboard
            </h2>
            <p className="text-sm text-slate-500">
              Manage, monitor, and dispatch your scheduled emails with automated BullMQ queueing.
            </p>
          </div>
        </div>

        {/* Overview Stats */}
        <StatsCards emails={emails} />

        {/* Table View */}
        <EmailTable
          emails={emails}
          loading={emailsLoading}
          onRefresh={loadEmails}
          onOpenCompose={() => setIsComposeOpen(true)}
        />
      </main>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSubmit={handleScheduleEmail}
        userEmail={user.email}
      />
    </div>
  );
};

export default App;
