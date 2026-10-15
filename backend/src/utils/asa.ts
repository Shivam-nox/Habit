// ============================================================
// asa.ts — Adaptive Spending Algorithm Engine
// Full analytics, behavior analysis, predictions, alerts
// ============================================================

import { db } from "../db";
import {
  transactions,
  financialProfiles,
  categories,
  budgets,
  goals,
  habitMetrics,
} from "../db/schema";
import { eq, and, gte, lte, sql, desc, or, isNull } from "drizzle-orm";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface ASABudget {
  needsLimit: number;
  savingsLimit: number;
  wantsLimit: number;
  isOverspending: boolean;
  needsRatio: number;
  savingsRatio: number;
  wantsRatio: number;
}

export interface SpendingStats {
  totalIncome: number;
  totalExpense: number;
  totalNeeds: number;
  totalWants: number;
  savings: number;
  savingsRate: number; // %
}

export interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  total: number;
  count: number;
  percentOfExpense: number;
  intent: string | null;
  avgPerTransaction: number;
  trend: "up" | "down" | "stable"; // vs previous month
}

export interface DailyAverage {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface SpendingTrend {
  currentMonth: number;
  previousMonth: number;
  changePercent: number;
  direction: "up" | "down" | "stable";
}

export interface BudgetUtilization {
  categoryId: string;
  categoryName: string;
  budgetLimit: number;
  spent: number;
  utilization: number; // %
  status: "green" | "yellow" | "red";
  daysRemaining: number;
  projectedOverspend: number;
}

export interface BehaviorAnalysis {
  emotionalSpendingScore: number;     // 0–100
  impulseBuyingScore: number;         // 0–100
  weekendOverspendRatio: number;      // weekend spend / weekday spend ratio
  lateNightSpendPercent: number;      // % of transactions after 10pm
  topWeaknesses: string[];
  disciplineScore: number;            // 0–100 overall
  disciplineLabel: "Excellent" | "Good" | "Fair" | "Poor";
  recurringExpenses: RecurringExpense[];
  subscriptionEstimate: number;       // monthly subscription total
  unusedSubscriptions: string[];
}

export interface RecurringExpense {
  note: string;
  avgAmount: number;
  frequency: "weekly" | "monthly";
  category: string;
}

export interface PeakSpendingTime {
  hour: number;
  label: string; // "Morning", "Afternoon", "Evening", "Late Night"
  total: number;
}

export interface SpendingVolatility {
  stdDev: number;
  coefficientOfVariation: number; // stdDev / mean
  label: "Stable" | "Moderate" | "Volatile";
}

export interface Alert {
  id: string;
  type: "budget_warning" | "spike" | "overspend" | "streak" | "goal" | "subscription";
  severity: "green" | "yellow" | "red";
  message: string;
  category?: string;
  amount?: number;
  timestamp: Date;
}

export interface Prediction {
  projectedMonthlyExpense: number;
  projectedSavings: number;
  daysUntilBudgetExhausted: number | null; // null = won't exhaust
  nextMonthForecast: number;
  riskLevel: "low" | "medium" | "high";
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalSpent: number;
  totalIncome: number;
  topCategory: string;
  savingsThisWeek: number;
  vsLastWeek: number; // %
  alerts: Alert[];
  topInsight: string;
}

export interface FullAnalytics {
  budget: ASABudget;
  stats: SpendingStats;
  categoryBreakdown: CategoryBreakdown[];
  dailyAverages: DailyAverage;
  spendingTrend: SpendingTrend;
  budgetUtilization: BudgetUtilization[];
  behavior: BehaviorAnalysis;
  peakSpendingTimes: PeakSpendingTime[];
  volatility: SpendingVolatility;
  alerts: Alert[];
  prediction: Prediction;
  weeklyReport: WeeklyReport;
  coachingInsights: string[];
  optimizedBudget: OptimizedBudget;
}

export interface OptimizedBudget {
  needs: number;
  wants: number;
  savings: number;
  recommendations: string[];
}

// ─────────────────────────────────────────────
// CORE ASA CALCULATION
// ─────────────────────────────────────────────

/**
 * Adaptive Spending Algorithm:
 * - Needs: 50% of income, capped at 60%, must cover fixedNeeds
 * - Savings: max(targetGoal, 20% of income)
 * - Wants: whatever remains (min 0)
 */
export const calculateAdaptiveBudget = (
  income: number,
  fixedNeeds: number,
  targetGoal: number
): ASABudget => {
  const needsLimit = Math.min(Math.max(0.5 * income, fixedNeeds * 1.2), 0.6 * income);
  const savingsLimit = Math.max(targetGoal, 0.2 * income);
  let wantsLimit = income - needsLimit - savingsLimit;
  const isOverspending = wantsLimit < 0;
  if (isOverspending) wantsLimit = 0;

  return {
    needsLimit,
    savingsLimit,
    wantsLimit,
    isOverspending,
    needsRatio: needsLimit / income,
    savingsRatio: savingsLimit / income,
    wantsRatio: wantsLimit / income,
  };
};

// ─────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────

export const getDateRange = () => {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split("T")[0];

  const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString().split("T")[0];
  const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString().split("T")[0];

  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
    .toISOString().split("T")[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000)
    .toISOString().split("T")[0];

  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return {
    today,
    firstDayOfMonth,
    firstDayOfLastMonth,
    lastDayOfLastMonth,
    sevenDaysAgo,
    fourteenDaysAgo,
    daysElapsed,
    daysInMonth,
  };
};

// ─────────────────────────────────────────────
// SPENDING STATS
// ─────────────────────────────────────────────

export const getSpendingStats = async (
  userId: string,
  from: string,
  to: string
): Promise<SpendingStats> => {
  const rows = await db
    .select({
      type: transactions.type,
      intent: transactions.intent,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .groupBy(transactions.type, transactions.intent);

  let totalIncome = 0, totalExpense = 0, totalNeeds = 0, totalWants = 0;

  rows.forEach((r) => {
    const amt = parseFloat(r.total);
    if (r.type === "income") totalIncome += amt;
    else if (r.type === "expense") {
      totalExpense += amt;
      if (r.intent === "need") totalNeeds += amt;
      if (r.intent === "want") totalWants += amt;
    }
  });

  const savings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

  return { totalIncome, totalExpense, totalNeeds, totalWants, savings, savingsRate };
};

// ─────────────────────────────────────────────
// CATEGORY BREAKDOWN
// ─────────────────────────────────────────────

export const getCategoryBreakdown = async (
  userId: string,
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string
): Promise<CategoryBreakdown[]> => {
  const current = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      count: sql<number>`COUNT(*)`,
      intent: transactions.intent,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .groupBy(transactions.categoryId, categories.name, transactions.intent);

  const previous = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, prevFrom),
        lte(transactions.date, prevTo)
      )
    )
    .groupBy(transactions.categoryId);

  const prevMap = new Map(previous.map((p) => [p.categoryId, parseFloat(p.total)]));
  const totalExpense = current.reduce((sum, r) => sum + parseFloat(r.total), 0);

  return current.map((r) => {
    const total = parseFloat(r.total);
    const prevTotal = prevMap.get(r.categoryId) ?? 0;
    let trend: "up" | "down" | "stable" = "stable";
    if (prevTotal > 0) {
      const diff = ((total - prevTotal) / prevTotal) * 100;
      if (diff > 10) trend = "up";
      else if (diff < -10) trend = "down";
    }
    return {
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      total,
      count: Number(r.count),
      percentOfExpense: totalExpense > 0 ? (total / totalExpense) * 100 : 0,
      intent: r.intent,
      avgPerTransaction: Number(r.count) > 0 ? total / Number(r.count) : 0,
      trend,
    };
  }).sort((a, b) => b.total - a.total);
};

// ─────────────────────────────────────────────
// DAILY / WEEKLY / MONTHLY AVERAGES
// ─────────────────────────────────────────────

export const getDailyAverages = (
  totalExpense: number,
  daysElapsed: number
): DailyAverage => {
  const daily = daysElapsed > 0 ? totalExpense / daysElapsed : 0;
  return {
    daily,
    weekly: daily * 7,
    monthly: daily * 30,
  };
};

// ─────────────────────────────────────────────
// SPENDING TREND (current vs previous month)
// ─────────────────────────────────────────────

export const getSpendingTrend = async (
  userId: string,
  dates: ReturnType<typeof getDateRange>
): Promise<SpendingTrend> => {
  const [curr, prev] = await Promise.all([
    getSpendingStats(userId, dates.firstDayOfMonth, dates.today),
    getSpendingStats(userId, dates.firstDayOfLastMonth, dates.lastDayOfLastMonth),
  ]);

  const changePercent =
    prev.totalExpense > 0
      ? ((curr.totalExpense - prev.totalExpense) / prev.totalExpense) * 100
      : 0;

  return {
    currentMonth: curr.totalExpense,
    previousMonth: prev.totalExpense,
    changePercent,
    direction:
      changePercent > 5 ? "up" : changePercent < -5 ? "down" : "stable",
  };
};

// ─────────────────────────────────────────────
// BUDGET UTILIZATION
// ─────────────────────────────────────────────

export const getBudgetUtilization = async (
  userId: string,
  from: string,
  to: string,
  daysElapsed: number,
  daysInMonth: number
): Promise<BudgetUtilization[]> => {
  const userBudgets = await db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      limitAmount: budgets.limitAmount,
      categoryName: categories.name,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.userId, userId));

  const result: BudgetUtilization[] = [];

  for (const b of userBudgets) {
    const [spendRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, b.categoryId),
          eq(transactions.type, "expense"),
          gte(transactions.date, from),
          lte(transactions.date, to)
        )
      );

    const spent = parseFloat(spendRow?.total ?? "0");
    const limit = parseFloat(b.limitAmount as string);
    const utilization = limit > 0 ? (spent / limit) * 100 : 0;
    const daysRemaining = daysInMonth - daysElapsed;
    const dailyBurnRate = daysElapsed > 0 ? spent / daysElapsed : 0;
    const projectedTotal = dailyBurnRate * daysInMonth;
    const projectedOverspend = Math.max(0, projectedTotal - limit);

    result.push({
      categoryId: b.categoryId,
      categoryName: b.categoryName ?? "Unknown",
      budgetLimit: limit,
      spent,
      utilization,
      status:
        utilization >= 100 ? "red" : utilization >= 80 ? "yellow" : "green",
      daysRemaining,
      projectedOverspend,
    });
  }

  return result;
};

// ─────────────────────────────────────────────
// BEHAVIOR ANALYSIS
// ─────────────────────────────────────────────

export const analyzeBehavior = async (
  userId: string,
  from: string,
  to: string,
  spendingWeakness: string,
  baseIncome: number = 0
): Promise<BehaviorAnalysis> => {
  // Fetch all transactions with timestamps
  const txns = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      intent: transactions.intent,
      note: transactions.note,
      date: transactions.date,
      createdAt: transactions.createdAt,
      categoryName: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .orderBy(transactions.createdAt);

  // NOTE (Issue #26): Time-based insights (like Emotional Spending and Late Night Spending) 
  // currently rely on `createdAt` (the timestamp of record creation) rather than `date`.
  // If a user backdates a transaction using the Add Tab's date picker, these specific 
  // behavioral metrics will reflect when the user logged it, not when it occurred.

  // ── Emotional Spending: 3+ transactions within 1 hour ──
  let emotionalClusters = 0;
  for (let i = 0; i < txns.length - 2; i++) {
    const t1 = new Date(txns[i].createdAt!).getTime();
    const t3 = new Date(txns[i + 2].createdAt!).getTime();
    if (t3 - t1 < 3600000) emotionalClusters++;
  }
  const emotionalSpendingScore = Math.min(100, emotionalClusters * 15);

  // ── Impulse Buying: transactions < threshold in "want" category ──
  const impulseThreshold = baseIncome > 0 ? baseIncome * 0.005 : 500;
  const impulseCount = txns.filter(
    (t) => parseFloat(t.amount as string) < impulseThreshold && t.intent === "want"
  ).length;
  const impulseBuyingScore = Math.min(100, (impulseCount / Math.max(txns.length, 1)) * 150);

  // ── Weekend vs Weekday Spending ──
  let weekendTotal = 0, weekdayTotal = 0;
  txns.forEach((t) => {
    const day = new Date(t.date).getDay();
    const amt = parseFloat(t.amount as string);
    if (day === 0 || day === 6) weekendTotal += amt;
    else weekdayTotal += amt;
  });
  const weekendOverspendRatio =
    weekdayTotal > 0 ? weekendTotal / weekdayTotal : 1;

  // ── Late Night Spending (after 10pm) ──
  const lateNightCount = txns.filter((t) => {
    const hour = new Date(t.createdAt!).getHours();
    return hour >= 22 || hour < 3;
  }).length;
  const lateNightSpendPercent =
    txns.length > 0 ? (lateNightCount / txns.length) * 100 : 0;

  // ── Top Weaknesses ──
  const weaknessArr = spendingWeakness
    ? spendingWeakness.split(",").map((w) => w.trim())
    : [];
  const catCounts = new Map<string, number>();
  txns.forEach((t) => catCounts.set(t.categoryName, (catCounts.get(t.categoryName) ?? 0) + 1));
  const topCats = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  const topWeaknesses = [...new Set([...weaknessArr, ...topCats])].slice(0, 5);

  // ── Discipline Score ──
  // Perfect score = 100, deduct for bad behaviors
  let disciplineScore = 100;
  disciplineScore -= Math.min(30, emotionalSpendingScore * 0.3);
  disciplineScore -= Math.min(20, impulseBuyingScore * 0.2);
  disciplineScore -= weekendOverspendRatio > 1.5 ? 15 : weekendOverspendRatio > 1.2 ? 8 : 0;
  disciplineScore -= lateNightSpendPercent > 20 ? 15 : lateNightSpendPercent > 10 ? 8 : 0;
  disciplineScore = Math.max(0, Math.round(disciplineScore));

  const disciplineLabel =
    disciplineScore >= 80 ? "Excellent" :
    disciplineScore >= 60 ? "Good" :
    disciplineScore >= 40 ? "Fair" : "Poor";

  // ── Recurring Expense Detection ──
  // Group by note/category and detect similar monthly patterns
  const noteMap = new Map<string, number[]>();
  txns.forEach((t) => {
    const key = (t.note ?? t.categoryName).toLowerCase().slice(0, 20);
    const existing = noteMap.get(key) ?? [];
    existing.push(parseFloat(t.amount as string));
    noteMap.set(key, existing);
  });

  const recurringExpenses: RecurringExpense[] = [];
  noteMap.forEach((amounts, note) => {
    if (amounts.length >= 2) {
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const variance =
        amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length;
      if (variance < avg * 0.5) {
        recurringExpenses.push({
          note,
          avgAmount: avg,
          frequency: amounts.length >= 4 ? "weekly" : "monthly",
          category: note,
        });
      }
    }
  });

  // ── Subscription Estimate ──
  const subscriptionKeywords = [
    "netflix", "spotify", "youtube", "amazon prime", "hotstar", "disney",
    "apple", "google", "gym", "subscription", "membership", "plan",
  ];
  const subTxns = txns.filter((t) =>
    subscriptionKeywords.some((k) =>
      (t.note ?? "").toLowerCase().includes(k) ||
      t.categoryName.toLowerCase().includes(k)
    )
  );
  const subscriptionEstimate = subTxns.reduce(
    (s, t) => s + parseFloat(t.amount as string), 0
  );

  // ── Unused Subscriptions (paid but no related activity) ──
  const unusedSubscriptions: string[] = subTxns
    .filter((t) => parseFloat(t.amount as string) > 0)
    .map((t) => t.note ?? t.categoryName)
    .filter((name, idx, arr) => arr.indexOf(name) === idx)
    .slice(0, 3);

  return {
    emotionalSpendingScore,
    impulseBuyingScore,
    weekendOverspendRatio,
    lateNightSpendPercent,
    topWeaknesses,
    disciplineScore,
    disciplineLabel,
    recurringExpenses,
    subscriptionEstimate,
    unusedSubscriptions,
  };
};

// ─────────────────────────────────────────────
// PEAK SPENDING TIMES
// ─────────────────────────────────────────────

export const getPeakSpendingTimes = async (
  userId: string,
  from: string
): Promise<PeakSpendingTime[]> => {
  const txns = await db
    .select({ amount: transactions.amount, createdAt: transactions.createdAt })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, from)
      )
    );

  const hourMap = new Map<number, number>();
  txns.forEach((t) => {
    const hour = new Date(t.createdAt!).getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + parseFloat(t.amount as string));
  });

  const LABELS: Record<string, string> = {
    morning: "Morning (6–11am)",
    afternoon: "Afternoon (12–5pm)",
    evening: "Evening (6–9pm)",
    latenight: "Late Night (10pm–3am)",
  };

  const buckets: Record<string, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    latenight: 0,
  };

  hourMap.forEach((total, hour) => {
    if (hour >= 6 && hour < 12) buckets.morning += total;
    else if (hour >= 12 && hour < 18) buckets.afternoon += total;
    else if (hour >= 18 && hour < 22) buckets.evening += total;
    else buckets.latenight += total;
  });

  return Object.entries(buckets)
    .map(([key, total], i) => ({
      hour: i * 6,
      label: LABELS[key],
      total,
    }))
    .sort((a, b) => b.total - a.total);
};

// ─────────────────────────────────────────────
// SPENDING VOLATILITY
// ─────────────────────────────────────────────

export const getSpendingVolatility = async (
  userId: string,
  from: string,
  to: string
): Promise<SpendingVolatility> => {
  const rows = await db
    .select({
      date: transactions.date,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .groupBy(transactions.date);

  const amounts = rows.map((r) => parseFloat(r.total));
  if (amounts.length === 0)
    return { stdDev: 0, coefficientOfVariation: 0, label: "Stable" };

  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  const variance =
    amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? (stdDev / mean) * 100 : 0;

  const label =
    coefficientOfVariation < 30
      ? "Stable"
      : coefficientOfVariation < 70
      ? "Moderate"
      : "Volatile";

  return { stdDev, coefficientOfVariation, label };
};

// ─────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────

export const generateAlerts = (
  budgetUtilization: BudgetUtilization[],
  spendingTrend: SpendingTrend,
  behavior: BehaviorAnalysis,
  stats: SpendingStats,
  asa: ASABudget
): Alert[] => {
  const alerts: Alert[] = [];
  const now = new Date();

  // Budget threshold alerts
  budgetUtilization.forEach((b) => {
    if (b.utilization >= 100) {
      alerts.push({
        id: `overspend_${b.categoryId}`,
        type: "overspend",
        severity: "red",
        message: `🚨 You've blown your ${b.categoryName} budget by ₹${(b.spent - b.budgetLimit).toFixed(0)}!`,
        category: b.categoryName,
        amount: b.spent - b.budgetLimit,
        timestamp: now,
      });
    } else if (b.utilization >= 90) {
      alerts.push({
        id: `warn90_${b.categoryId}`,
        type: "budget_warning",
        severity: "red",
        message: `⚠️ ${b.categoryName} budget is 90% used — only ₹${(b.budgetLimit - b.spent).toFixed(0)} left.`,
        category: b.categoryName,
        timestamp: now,
      });
    } else if (b.utilization >= 80) {
      alerts.push({
        id: `warn80_${b.categoryId}`,
        type: "budget_warning",
        severity: "yellow",
        message: `🟡 ${b.categoryName} budget is 80% used — ₹${(b.budgetLimit - b.spent).toFixed(0)} remaining.`,
        category: b.categoryName,
        timestamp: now,
      });
    }

    // Projected overspend
    if (b.projectedOverspend > 0) {
      alerts.push({
        id: `projected_${b.categoryId}`,
        type: "spike",
        severity: "yellow",
        message: `📈 At this rate, you'll overspend ${b.categoryName} by ₹${b.projectedOverspend.toFixed(0)} this month.`,
        category: b.categoryName,
        amount: b.projectedOverspend,
        timestamp: now,
      });
    }
  });

  // Spending spike
  if (spendingTrend.changePercent > 30) {
    alerts.push({
      id: "spike_monthly",
      type: "spike",
      severity: "red",
      message: `📊 You're spending ${spendingTrend.changePercent.toFixed(0)}% more than last month!`,
      timestamp: now,
    });
  }

  // Late night alert
  if (behavior.lateNightSpendPercent > 25) {
    alerts.push({
      id: "latenight",
      type: "spike",
      severity: "yellow",
      message: `🌙 ${behavior.lateNightSpendPercent.toFixed(0)}% of your purchases happen late at night — consider a spending curfew.`,
      timestamp: now,
    });
  }

  // Savings rate alert
  if (stats.savingsRate < 10) {
    alerts.push({
      id: "savings_low",
      type: "overspend",
      severity: "red",
      message: `💸 Your savings rate is only ${stats.savingsRate.toFixed(1)}% — you need at least 20%.`,
      timestamp: now,
    });
  } else if (stats.savingsRate >= 25) {
    alerts.push({
      id: "savings_great",
      type: "streak",
      severity: "green",
      message: `🎉 Excellent! You're saving ${stats.savingsRate.toFixed(1)}% of your income this month.`,
      timestamp: now,
    });
  }

  // Subscription bloat
  if (behavior.subscriptionEstimate > 0.1 * (stats.totalIncome || 1)) {
    alerts.push({
      id: "subscription_bloat",
      type: "subscription",
      severity: "yellow",
      message: `📦 Your subscriptions are eating ₹${behavior.subscriptionEstimate.toFixed(0)}/month. Consider auditing them.`,
      amount: behavior.subscriptionEstimate,
      timestamp: now,
    });
  }

  return alerts.sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 };
    return order[a.severity] - order[b.severity];
  });
};

// ─────────────────────────────────────────────
// PREDICTIONS
// ─────────────────────────────────────────────

export const generatePredictions = (
  stats: SpendingStats,
  asa: ASABudget,
  daysElapsed: number,
  daysInMonth: number
): Prediction => {
  const dailyBurnRate = daysElapsed > 0 ? stats.totalExpense / daysElapsed : 0;
  const projectedMonthlyExpense = dailyBurnRate * daysInMonth;
  const projectedSavings = stats.totalIncome - projectedMonthlyExpense;

  const wantsRemaining = asa.wantsLimit - stats.totalWants;
  const needsRemaining = asa.needsLimit - stats.totalNeeds;
  const totalBudgetRemaining = wantsRemaining + needsRemaining;

  const daysUntilBudgetExhausted =
    dailyBurnRate > 0 && totalBudgetRemaining > 0
      ? Math.floor(totalBudgetRemaining / dailyBurnRate)
      : null;

  // Predict next month using 10% trend adjustment
  const nextMonthForecast = projectedMonthlyExpense * 1.05; // slight growth bias

  const riskLevel =
    projectedMonthlyExpense > stats.totalIncome
      ? "high"
      : projectedMonthlyExpense > asa.needsLimit + asa.wantsLimit
      ? "medium"
      : "low";

  return {
    projectedMonthlyExpense,
    projectedSavings,
    daysUntilBudgetExhausted,
    nextMonthForecast,
    riskLevel,
  };
};

// ─────────────────────────────────────────────
// OPTIMIZED BUDGET RECOMMENDATION
// ─────────────────────────────────────────────

export const getOptimizedBudget = (
  income: number,
  currentNeeds: number,
  currentWants: number,
  behavior: BehaviorAnalysis,
  topWeaknesses: string[]
): OptimizedBudget => {
  // Target allocation: 50/30/20
  const targetNeeds = 0.5 * income;
  const targetWants = 0.3 * income;
  const targetSavings = 0.2 * income;
  const recommendations: string[] = [];

  if (currentWants > targetWants) {
    const reduction = currentWants - targetWants;
    recommendations.push(
      `Cut Wants spending by ₹${reduction.toFixed(0)} to hit the 50/30/20 rule.`
    );
  }

  if (behavior.impulseBuyingScore > 50) {
    recommendations.push(
      `Enable a ₹${(targetWants * 0.2).toFixed(0)} "impulse budget" to control unplanned buys.`
    );
  }

  if (behavior.subscriptionEstimate > 0.05 * income) {
    recommendations.push(
      `Audit ₹${behavior.subscriptionEstimate.toFixed(0)} in subscriptions — cancel what you don't use weekly.`
    );
  }

  topWeaknesses.slice(0, 2).forEach((w) => {
    recommendations.push(
      `Set a weekly cap for "${w}" — it's one of your top spending triggers.`
    );
  });

  if (behavior.weekendOverspendRatio > 1.5) {
    recommendations.push(
      `Set a weekend spending limit — you spend ${((behavior.weekendOverspendRatio - 1) * 100).toFixed(0)}% more on weekends.`
    );
  }

  return {
    needs: targetNeeds,
    wants: targetWants,
    savings: targetSavings,
    recommendations,
  };
};

// ─────────────────────────────────────────────
// WEEKLY REPORT
// ─────────────────────────────────────────────

export const getWeeklyReport = async (
  userId: string,
  stats: SpendingStats,
  categoryBreakdown: CategoryBreakdown[],
  alerts: Alert[]
): Promise<WeeklyReport> => {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86400000)
    .toISOString().split("T")[0];
  const weekEnd = now.toISOString().split("T")[0];

  const weekStats = await getSpendingStats(userId, weekStart, weekEnd);
  const prevWeekStart = new Date(now.getTime() - 14 * 86400000)
    .toISOString().split("T")[0];
  const prevWeekEnd = new Date(now.getTime() - 8 * 86400000)
    .toISOString().split("T")[0];
  const prevWeekStats = await getSpendingStats(userId, prevWeekStart, prevWeekEnd);

  const vsLastWeek =
    prevWeekStats.totalExpense > 0
      ? ((weekStats.totalExpense - prevWeekStats.totalExpense) /
          prevWeekStats.totalExpense) *
        100
      : 0;

  const topCategory = categoryBreakdown[0]?.categoryName ?? "N/A";
  const topInsight =
    vsLastWeek > 10
      ? `You spent ${vsLastWeek.toFixed(0)}% more this week vs last. Watch your ${topCategory} spending.`
      : vsLastWeek < -10
      ? `Great job! You cut spending by ${Math.abs(vsLastWeek).toFixed(0)}% vs last week. Keep it up! 🎉`
      : `Spending is stable this week. Your top category is ${topCategory}.`;

  return {
    weekStart,
    weekEnd,
    totalSpent: weekStats.totalExpense,
    totalIncome: weekStats.totalIncome,
    topCategory,
    savingsThisWeek: weekStats.savings,
    vsLastWeek,
    alerts: alerts.slice(0, 3),
    topInsight,
  };
};

// ─────────────────────────────────────────────
// COACHING INSIGHTS (text coaching messages)
// ─────────────────────────────────────────────

export const generateCoachingInsights = (
  stats: SpendingStats,
  asa: ASABudget,
  behavior: BehaviorAnalysis,
  trend: SpendingTrend,
  prediction: Prediction,
  categoryBreakdown: CategoryBreakdown[]
): string[] => {
  const insights: string[] = [];

  // Savings insight
  if (stats.savingsRate >= 25) {
    insights.push(`🏆 You're saving ${stats.savingsRate.toFixed(1)}% this month — that's above average. Keep it up!`);
  } else if (stats.savingsRate < 10) {
    insights.push(`⚠️ Your savings rate is ${stats.savingsRate.toFixed(1)}%. Try the 50/30/20 rule to get to at least 20%.`);
  }

  // Spending trend
  if (trend.direction === "up") {
    insights.push(
      `📈 You're spending ${trend.changePercent.toFixed(0)}% more than last month. ` +
      `If this continues, you'll spend ₹${prediction.projectedMonthlyExpense.toFixed(0)} total.`
    );
  } else if (trend.direction === "down") {
    insights.push(
      `📉 You reduced expenses by ${Math.abs(trend.changePercent).toFixed(0)}% vs last month. Excellent discipline!`
    );
  }

  // Top category warning
  const topCat = categoryBreakdown[0];
  if (topCat && topCat.percentOfExpense > 35) {
    insights.push(
      `🔍 "${topCat.categoryName}" makes up ${topCat.percentOfExpense.toFixed(0)}% of your spending. ` +
      `Consider reducing it by 20% — that saves ₹${(topCat.total * 0.2).toFixed(0)}.`
    );
  }

  // Impulse buying
  if (behavior.impulseBuyingScore > 60) {
    insights.push(
      `🛍️ High impulse buying detected. Try the 24-hour rule: wait a day before any unplanned purchase.`
    );
  }

  // Weekend overspend
  if (behavior.weekendOverspendRatio > 1.4) {
    insights.push(
      `📅 You spend ${((behavior.weekendOverspendRatio - 1) * 100).toFixed(0)}% more on weekends. ` +
      `Try setting a weekend spending envelope of ₹${(asa.wantsLimit * 0.4).toFixed(0)}.`
    );
  }

  // Budget exhaust prediction
  if (prediction.daysUntilBudgetExhausted !== null && prediction.daysUntilBudgetExhausted < 10) {
    insights.push(
      `⏳ At your current burn rate, you'll exhaust your discretionary budget in ${prediction.daysUntilBudgetExhausted} days.`
    );
  }

  // Subscription bloat
  if (behavior.subscriptionEstimate > 500) {
    insights.push(
      `📦 You're paying ₹${behavior.subscriptionEstimate.toFixed(0)}/month on subscriptions. ` +
      `Review these: ${behavior.unusedSubscriptions.slice(0, 2).join(", ")}.`
    );
  }

  // Discipline score
  if (behavior.disciplineScore >= 80) {
    insights.push(`🌟 Discipline Score: ${behavior.disciplineScore}/100 — ${behavior.disciplineLabel}. You're crushing it!`);
  } else {
    insights.push(
      `💪 Discipline Score: ${behavior.disciplineScore}/100 (${behavior.disciplineLabel}). ` +
      `Focus on reducing impulse buys and emotional spending to improve.`
    );
  }

  return insights;
};

// ─────────────────────────────────────────────
// MASTER ANALYTICS RUNNER
// ─────────────────────────────────────────────

export const runFullAnalytics = async (userId: string): Promise<FullAnalytics> => {
  const dates = getDateRange();

  // Fetch profile
  const [profile] = await db
    .select()
    .from(financialProfiles)
    .where(eq(financialProfiles.userId, userId));

  const baseIncome = profile ? parseFloat(profile.baseIncome as string) : 0;
  const fixedNeeds = profile ? parseFloat(profile.fixedNeeds as string) : 0;
  const targetGoal = profile ? parseFloat(profile.targetSavingsGoal as string) : 0;
  const spendingWeakness = profile?.spendingWeakness ?? "";

  // Core calculations
  const asa = calculateAdaptiveBudget(baseIncome, fixedNeeds, targetGoal);
  const stats = await getSpendingStats(userId, dates.firstDayOfMonth, dates.today);
  if (stats.totalIncome === 0 && baseIncome > 0) stats.totalIncome = baseIncome;

  const [
    categoryBreakdown,
    spendingTrend,
    budgetUtilization,
    behavior,
    peakSpendingTimes,
    volatility,
  ] = await Promise.all([
    getCategoryBreakdown(
      userId,
      dates.firstDayOfMonth,
      dates.today,
      dates.firstDayOfLastMonth,
      dates.lastDayOfLastMonth
    ),
    getSpendingTrend(userId, dates),
    getBudgetUtilization(
      userId,
      dates.firstDayOfMonth,
      dates.today,
      dates.daysElapsed,
      dates.daysInMonth
    ),
    analyzeBehavior(userId, dates.firstDayOfMonth, dates.today, spendingWeakness, baseIncome),
    getPeakSpendingTimes(userId, dates.firstDayOfMonth),
    getSpendingVolatility(userId, dates.firstDayOfMonth, dates.today),
  ]);

  const dailyAverages = getDailyAverages(stats.totalExpense, dates.daysElapsed);
  const alerts = generateAlerts(budgetUtilization, spendingTrend, behavior, stats, asa);
  const prediction = generatePredictions(stats, asa, dates.daysElapsed, dates.daysInMonth);
  const optimizedBudget = getOptimizedBudget(
    baseIncome,
    stats.totalNeeds,
    stats.totalWants,
    behavior,
    behavior.topWeaknesses
  );
  const weeklyReport = await getWeeklyReport(userId, stats, categoryBreakdown, alerts);
  const coachingInsights = generateCoachingInsights(
    stats, asa, behavior, spendingTrend, prediction, categoryBreakdown
  );

  return {
    budget: asa,
    stats,
    categoryBreakdown,
    dailyAverages,
    spendingTrend,
    budgetUtilization,
    behavior,
    peakSpendingTimes,
    volatility,
    alerts,
    prediction,
    weeklyReport,
    coachingInsights,
    optimizedBudget,
  };
};