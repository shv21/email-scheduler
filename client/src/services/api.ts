import { User, EmailItem, ComposeEmailPayload, ApiResponse } from '../types';

const API_BASE = '/api';

/**
 * Standard fetch wrapper with credentials included for session cookies
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // essential for HTTP-only cookies
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      data.message || (data.errors && data.errors[0]?.message) || `HTTP error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await request<User>('/auth/me', { method: 'GET' });
      return res.user || (res.data as unknown as User) || null;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    await request('/auth/logout', { method: 'POST' });
  },

  async devLogin(): Promise<User> {
    const res = await request<User>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'alex.developer@gmail.com',
        displayName: 'Alex Developer',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      }),
    });
    return res.user || (res.data as unknown as User)!;
  },

  // Emails
  async getEmails(status?: string): Promise<EmailItem[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await request<EmailItem[]>(`/emails${query}`, { method: 'GET' });
    return res.data || [];
  },

  async scheduleEmail(payload: ComposeEmailPayload): Promise<EmailItem> {
    const res = await request<EmailItem>('/emails', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data!;
  },
};
