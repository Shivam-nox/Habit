// ================================================================
// CHANGES NEEDED — api.ts additions + backend route changes
// Add these to your existing api.ts and backend router files
// ================================================================

// ───────────────────────────────────────────────────────────────
// 1. ADD TO services/api.ts  (paste inside the return { ... } block)
// ───────────────────────────────────────────────────────────────

/*

    // ==========================================
    // 6. ANALYTICS DASHBOARD (NEW)
    // ==========================================

    getDashboard: async () => {
      const response = await fetch(`${BASE_URL}/dashboard`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ==========================================
    // 7. COACHING INSIGHTS (NEW)
    // ==========================================

    getCoachingInsights: async () => {
      const response = await fetch(`${BASE_URL}/insights`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ==========================================
    // 8. ALERTS (NEW)
    // ==========================================

    getAlerts: async () => {
      const response = await fetch(`${BASE_URL}/alerts`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ==========================================
    // 9. WEEKLY REPORT (NEW)
    // ==========================================

    getWeeklyReport: async () => {
      const response = await fetch(`${BASE_URL}/weekly-report`, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ==========================================
    // 10. UPDATE BUDGET (NEW)
    // ==========================================

    updateBudget: async (categoryId: string, limitAmount: number) => {
      const response = await fetch(`${BASE_URL}/budgets`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ categoryId, limitAmount }),
      });
      return handleResponse(response);
    },

    // ==========================================
    // 11. ADD EXPENSE (manual, non-AI) (NEW)
    // ==========================================

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

*/


// ───────────────────────────────────────────────────────────────
// 2. BACKEND ROUTE ADDITIONS  (add to your Express router file)
// ───────────────────────────────────────────────────────────────

/*
  All these handlers are already written in chat.ts from the previous step.
  Just wire them to routes:

  import {
    chatWithCoach,
    getDashboard,
    getCoachingInsights,
    getAlerts,
    getWeeklyReportEndpoint,
    updateBudget,
    updateGoal,
    addExpense,
  } from './routes/chat';

  // Existing
  router.post('/chat',          authMiddleware, chatWithCoach);

  // New — add these:
  router.get('/dashboard',      authMiddleware, getDashboard);
  router.get('/insights',       authMiddleware, getCoachingInsights);
  router.get('/alerts',         authMiddleware, getAlerts);
  router.get('/weekly-report',  authMiddleware, getWeeklyReportEndpoint);
  router.post('/budgets',       authMiddleware, updateBudget);
  router.post('/goals-create',  authMiddleware, updateGoal);
  router.post('/expenses',      authMiddleware, addExpense);
*/


// ───────────────────────────────────────────────────────────────
// 3. NAVIGATION — add Charts screen to your navigator
// ───────────────────────────────────────────────────────────────

/*
  In your Tab or Stack navigator (e.g. navigation/AppNavigator.tsx):

  import ChartsScreen from '../screens/ChartsScreen';
  import DashboardScreen from '../screens/DashboardScreen';

  // Stack navigator additions:
  <Stack.Screen name="Charts" component={ChartsScreen} options={{ headerShown: false }} />

  // OR if Charts is a tab:
  <Tab.Screen
    name="Charts"
    component={ChartsScreen}
    options={{
      tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chart-bar" size={22} color={color} />,
      tabBarLabel: 'Charts',
    }}
  />
*/


// ───────────────────────────────────────────────────────────────
// 4. PACKAGE INSTALL — no new packages needed!
// ───────────────────────────────────────────────────────────────
// All charts are hand-rolled using Animated API (no external lib).
// Everything uses packages you already have:
//   - expo-linear-gradient  ✅
//   - moti                  ✅
//   - expo-haptics          ✅
//   - @expo/vector-icons    ✅
//   - react-native-safe-area-context ✅


// ───────────────────────────────────────────────────────────────
// 5. COMPLETE UPDATED api.ts (drop-in replacement)
// ───────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';
const HOST=process.env.EXPO_PUBLIC_API_URL || ' '
console.log('API HOST:', HOST);
const BASE_URL = `${HOST}/api`;

export const useApi = () => {
  const getHeaders = async () => {
    const token = await SecureStore.getItemAsync('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleResponse = async (response: Response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'An unexpected error occurred');
    }
    return data;
  };

  return {
    // ── AUTH ──────────────────────────────────────
    login: async (email: string, password: string) => {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(response);
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
      await SecureStore.deleteItemAsync('jwt_token');
    },

    savePushToken: async (token: string) => {
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

    // ── TRANSACTIONS & CATEGORIES ─────────────────
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

    // ── RECURRING ────────────────────────────────
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


    // ── RECURRING ACTIONS ────────────────────────────
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

    // ── GOALS ────────────────────────────────────
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

    // ── PROFILE ──────────────────────────────────
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

    // ── AI COACH ─────────────────────────────────
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

    // ── ANALYTICS (NEW) ──────────────────────────
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
      const url = month ? `${BASE_URL}/reports/generate?month=${month}` : `${BASE_URL}/reports/generate`;
      const response = await fetch(url, {
        headers: await getHeaders(),
      });
      return handleResponse(response);
    },

    // ── BUDGETS (NEW) ─────────────────────────────
    updateBudget: async (categoryId: string, limitAmount: number) => {
      const response = await fetch(`${BASE_URL}/budgets`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ categoryId, limitAmount }),
      });
      return handleResponse(response);
    },

    // ── EXPENSE (manual REST, non-AI) (NEW) ───────
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