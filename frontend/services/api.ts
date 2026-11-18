import { storage } from '../utils/storage';
import { Platform } from 'react-native';

const HOST = process.env.EXPO_PUBLIC_API_URL || '';
const BASE_URL = `${HOST}/api`;

export const useApi = () => {
  const getHeaders = async (): Promise<Record<string, string>> => {
    const token = await storage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleResponse = async (response: Response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as any).error || 'An unexpected error occurred');
    }
    return data;
  };

  return {
    // ── AUTH ──────────────────────────────────────────────────────
    login: async (email: string, password: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return handleResponse(response);
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          throw new Error('Server is warming up — please wait 30 seconds and try again.');
        }
        throw e;
      }
    },

    register: async (name: string, email: string, password: string) => {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      return handleResponse(response);
    },

    logout: async () => {
      await storage.deleteItem('jwt_token');
    },

    savePushToken: async (token: string) => {
      if (Platform.OS === 'web') return; // push tokens not supported on web
      const response = await fetch(`${BASE_URL}/auth/push-token`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ token }),
      });
      return handleResponse(response);
    },

    getNotifications: async () => {
      const response = await fetch(`${BASE_URL}/notifications`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ── TRANSACTIONS & CATEGORIES ─────────────────────────────────
    getCategories: async (type: 'income' | 'expense' | 'transfer') => {
      const response = await fetch(`${BASE_URL}/categories/${type}`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    getTransactions: async () => {
      const response = await fetch(`${BASE_URL}/transactions`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    addTransaction: async (transactionData: any) => {
      const response = await fetch(`${BASE_URL}/transactions`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(transactionData),
      });
      return handleResponse(response);
    },

    updateTransaction: async (id: string, transactionData: any) => {
      const response = await fetch(`${BASE_URL}/transactions/${id}`, {
        method: 'PUT',
        headers: await getHeaders(),
        body: JSON.stringify(transactionData),
      });
      return handleResponse(response);
    },

    deleteTransaction: async (id: string) => {
      const response = await fetch(`${BASE_URL}/transactions/${id}`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ── RECURRING ─────────────────────────────────────────────────
    getRecurringConfigs: async () => {
      const response = await fetch(`${BASE_URL}/recurring`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    addRecurring: async (recurringData: any) => {
      const response = await fetch(`${BASE_URL}/recurring`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(recurringData),
      });
      return handleResponse(response);
    },

    updateRecurringDate: async (id: string, nextDate: string) => {
      const response = await fetch(`${BASE_URL}/recurring/${id}/update-date`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ nextDate }),
      });
      return handleResponse(response);
    },

    processRecurring: async (id: string) => {
      const response = await fetch(`${BASE_URL}/recurring/${id}/process`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    cancelRecurring: async (id: string) => {
      const response = await fetch(`${BASE_URL}/recurring/${id}/cancel`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ── GOALS ─────────────────────────────────────────────────────
    getGoals: async () => {
      const response = await fetch(`${BASE_URL}/goals`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    createGoal: async (goalData: any) => {
      const response = await fetch(`${BASE_URL}/goals`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(goalData),
      });
      return handleResponse(response);
    },

    allocateGoalProgress: async (goalId: string, amount: number) => {
      const response = await fetch(`${BASE_URL}/goals/${goalId}/allocate`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ amount }),
      });
      return handleResponse(response);
    },

    // ── PROFILE ───────────────────────────────────────────────────
    getProfile: async () => {
      const response = await fetch(`${BASE_URL}/profile`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    updateProfile: async (profileData: any) => {
      const response = await fetch(`${BASE_URL}/profile`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(profileData),
      });
      return handleResponse(response);
    },

    // ── AI COACH ──────────────────────────────────────────────────
    chatWithCoach: async (message: string) => {
      const response = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ message }),
      });
      return handleResponse(response);
    },

    getChatHistory: async () => {
      const response = await fetch(`${BASE_URL}/chat-history`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    getAiContext: async (days: number = 30) => {
      const response = await fetch(`${BASE_URL}/ai-context?days=${days}`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ── ANALYTICS ─────────────────────────────────────────────────
    getDashboard: async () => {
      const response = await fetch(`${BASE_URL}/dashboard`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    getCoachingInsights: async () => {
      const response = await fetch(`${BASE_URL}/insights`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    getAlerts: async () => {
      const response = await fetch(`${BASE_URL}/alerts`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    getReportData: async (month?: string) => {
      const url = month
        ? `${BASE_URL}/reports/generate?month=${month}`
        : `${BASE_URL}/reports/generate`;
      const response = await fetch(url, { headers: await getHeaders() });
      return handleResponse(response);
    },

    // ── BUDGETS ───────────────────────────────────────────────────
    updateBudget: async (categoryId: string, limitAmount: number) => {
      const response = await fetch(`${BASE_URL}/budgets`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ categoryId, limitAmount }),
      });
      return handleResponse(response);
    },

    // ── EXPENSE ───────────────────────────────────────────────────
    addExpense: async (data: {
      amount: number;
      type: 'income' | 'expense';
      categoryId?: string;
      intent?: 'need' | 'want';
      paymentMode?: string;
      note?: string;
      date: string;
    }) => {
      const response = await fetch(`${BASE_URL}/expenses`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },
  };
};
