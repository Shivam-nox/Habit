// ============================================================
// chat.ts — Expense Habit Coach Backend
// Full coaching system with analytics, alerts, and AI routing
// ============================================================

import { Request, Response } from "express";
import Groq from "groq-sdk";
import { db } from "../db";
import {
  transactions,
  aiChatHistory,
  financialProfiles,
  categories,
  budgets,
  goals,
  habitMetrics,
} from "../db/schema";
import { eq, desc, and, gte, lte, sql, or, isNull } from "drizzle-orm";

import {
  runFullAnalytics,
  calculateAdaptiveBudget,
  getSpendingStats,
  generateAlerts,
  getDateRange,
  FullAnalytics,
  Alert,
} from ".././utils/asa";

// ─────────────────────────────────────────────
// GROQ CLIENT
// ─────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface AIResponse {
  action:
  | "ADD_TX"
  | "COACH_RESPONSE"
  | "SHOW_ANALYTICS"
  | "UPDATE_GOAL"
  | "SET_BUDGET"
  | "SHOW_REPORT";
  type: "income" | "expense" | null;
  amount: number | null;
  category: string | null;
  note: string | null;
  intent: "want" | "need" | null;
  paymentMode: "cash" | "card" | "upi" | "bank_transfer" | "other" | null;
  reply: string;
  // For goal actions
  goalName?: string;
  goalAmount?: number;
  // For budget actions
  budgetCategory?: string;
  budgetLimit?: number;
}

// ─────────────────────────────────────────────
// HELPER: Build condensed analytics summary for LLM context
// (Prevents token bloat while keeping the AI informed)
// ─────────────────────────────────────────────

const buildAnalyticsSummary = (analytics: FullAnalytics): string => {
  const { budget, stats, behavior, prediction, alerts, categoryBreakdown, weeklyReport } = analytics;

  const topAlerts = alerts
    .filter((a) => a.severity === "red" || a.severity === "yellow")
    .slice(0, 3)
    .map((a) => `- ${a.message}`)
    .join("\n");

  const topCategories = categoryBreakdown
    .slice(0, 4)
    .map((c) => `  • ${c.categoryName}: ₹${c.total.toFixed(0)} (${c.percentOfExpense.toFixed(0)}%)`)
    .join("\n");

  return `
--- LIVE ANALYTICS SNAPSHOT ---
📊 Income Baseline: ₹${stats.totalIncome.toFixed(0)}
💸 Total Spent: ₹${stats.totalExpense.toFixed(0)} | Savings: ₹${stats.savings.toFixed(0)} (${stats.savingsRate.toFixed(1)}%)

🎯 BUDGET LIMITS vs ACTUAL:
  • Needs Limit: ₹${budget.needsLimit.toFixed(0)} | Spent: ₹${stats.totalNeeds.toFixed(0)} | Left: ₹${(budget.needsLimit - stats.totalNeeds).toFixed(0)}
  • Wants Limit: ₹${budget.wantsLimit.toFixed(0)} | Spent: ₹${stats.totalWants.toFixed(0)} | Left: ₹${(budget.wantsLimit - stats.totalWants).toFixed(0)}
  • Savings Target: ₹${budget.savingsLimit.toFixed(0)}
  ${budget.isOverspending ? "⚠️ OVERSPENDING DETECTED — Wants budget is negative!" : ""}

📈 TRENDS:
  • Spending this month vs last: ${analytics.spendingTrend.changePercent.toFixed(0)}% ${analytics.spendingTrend.direction === "up" ? "📈 higher" : analytics.spendingTrend.direction === "down" ? "📉 lower" : "stable"}
  • Daily average burn: ₹${analytics.dailyAverages.daily.toFixed(0)}/day
  • Projected month-end expense: ₹${prediction.projectedMonthlyExpense.toFixed(0)}
  ${prediction.daysUntilBudgetExhausted !== null ? `• ⏳ Budget runs out in ~${prediction.daysUntilBudgetExhausted} days` : "• ✅ Budget will last the month"}

🔍 TOP SPENDING CATEGORIES:
${topCategories}

🧠 BEHAVIOR SCORES:
  • Discipline Score: ${behavior.disciplineScore}/100 (${behavior.disciplineLabel})
  • Impulse Buying Score: ${behavior.impulseBuyingScore.toFixed(0)}/100
  • Emotional Spending Score: ${behavior.emotionalSpendingScore.toFixed(0)}/100
  • Weekend Overspend Ratio: ${behavior.weekendOverspendRatio.toFixed(2)}x
  • Late Night Spend: ${behavior.lateNightSpendPercent.toFixed(0)}%
  • Top Weaknesses: ${behavior.topWeaknesses.join(", ")}

📦 SUBSCRIPTIONS: ₹${behavior.subscriptionEstimate.toFixed(0)}/month estimated
📅 WEEKLY REPORT: Spent ₹${weeklyReport.totalSpent.toFixed(0)} this week (${weeklyReport.vsLastWeek.toFixed(0)}% vs last week)

🚨 ACTIVE ALERTS (top 3):
${topAlerts || "  • No critical alerts 🎉"}
--------------------------------`;
};

// ─────────────────────────────────────────────
// HELPER: Build full system prompt
// ─────────────────────────────────────────────

const buildSystemPrompt = (
  analyticsSummary: string,
  categoryNames: string,
  today: string
): string => `You are shvm, an elite Indian personal finance coach powered by an Adaptive Spending Algorithm.
You are sharp, empathetic, data-driven, and speak like a trusted friend — not a robot.
Today: ${today}

${analyticsSummary}

--- RESPONSE SCHEMA (STRICT JSON ONLY) ---
You MUST respond ONLY with valid JSON. No markdown, no preamble.
{
  "action": "ADD_TX" | "COACH_RESPONSE" | "SHOW_ANALYTICS" | "UPDATE_GOAL" | "SET_BUDGET" | "SHOW_REPORT",
  "type": "income" | "expense" | null,
  "amount": number | null,
  "category": string | null,
  "note": string | null,
  "intent": "want" | "need" | null,
  "paymentMode": "cash" | "card" | "upi" | "bank_transfer" | "other" | null,
  "goalName": string | null,
  "goalAmount": number | null,
  "budgetCategory": string | null,
  "budgetLimit": number | null,
  "reply": "Your formatted reply using \\n\\n for line breaks"
}

--- STRICT RULES ---

1. LOGGING EXPENSES/INCOME (CRITICAL):
   - If the user mentions spending money OR receiving money, set action="ADD_TX", provide amount, type, category, and intent.
   - NEVER say "I've logged that" without using ADD_TX. No fake confirmations.
   - Needs = rent, groceries, medicine, EMI, utilities
   - Wants = food delivery, shopping, entertainment, eating out, impulse buys

2. COACHING INTELLIGENCE:
   - If they're about to overspend a Want category, warn them ONCE with exact remaining budget.
   - After one warning, if they insist, log it and move on — no lecturing.
   - If savings rate < 10%, always nudge them toward saving more.
   - Use real numbers from the analytics snapshot — never make up figures.
   - When a user says "how am I doing" or "show budget", return a rich breakdown.

3. PREDICTIONS:
   - If asked "will I save money this month?", use the projected data.
   - If budget is nearly exhausted, proactively warn before they ask.

4. BEHAVIOR COACHING:
   - If impulse buying score > 60, suggest the 24-hour rule.
   - If weekend overspend detected, suggest a weekend envelope.
   - If late night spending > 20%, suggest a night spending limit.

5. CATEGORIES (match strictly): ${categoryNames}

6. PAYMENT MODE: Infer from context — "paid by card", "UPI", "cash" etc. Default to null.

7. GOAL & BUDGET ACTIONS:
   - If user says "set a goal for X", action="UPDATE_GOAL", fill goalName and goalAmount.
   - If user says "set budget for X", action="SET_BUDGET", fill budgetCategory and budgetLimit.
   - If user asks for analytics/dashboard/report, action="SHOW_ANALYTICS" or "SHOW_REPORT".

8. FORMATTING:
   - Use emojis, \\n\\n for spacing, bullet points (•).
   - Always use ₹ symbol for Indian Rupees.
   - Keep replies under 200 words unless showing a full report.
   - Be warm, specific, and actionable.

9. MOTIVATION:
   - If savings improved vs last month, celebrate it.
   - If discipline score is high, acknowledge it.
   - If they're struggling, be empathetic but firm.

--- BUDGET TEMPLATE (use this when asked for budget/how am I doing) ---
📊 **Your Live Budget Breakdown**\\n\\n
• 🏠 Needs: ₹[needsLimit] total → ₹[remaining] left\\n
• 🍕 Wants: ₹[wantsLimit] total → ₹[remaining] left\\n
• 💰 Savings Target: ₹[savingsLimit]\\n
• 📈 Savings Rate: [rate]%\\n
• 🎯 Discipline Score: [score]/100 ([label])\\n\\n
[2-line personalized insight based on their actual data]`;

// ─────────────────────────────────────────────
// HELPER: Streak updater
// ─────────────────────────────────────────────

const updateHabitStreak = async (userId: string, today: string) => {
  try {
    const [metric] = await db
      .select()
      .from(habitMetrics)
      .where(eq(habitMetrics.userId, userId));

    if (!metric) {
      await db.insert(habitMetrics).values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastLoggedAt: today,
      });
      return;
    }

    const lastLogged = metric.lastLoggedAt;
    const yesterday = new Date(new Date().getTime() - 86400000)
      .toISOString().split("T")[0];

    if (lastLogged === today) return; // Already logged today

    const newStreak =
      lastLogged === yesterday ? (metric.currentStreak ?? 0) + 1 : 1;
    const longestStreak = Math.max(metric.longestStreak ?? 0, newStreak);

    await db
      .update(habitMetrics)
      .set({ currentStreak: newStreak, longestStreak, lastLoggedAt: today })
      .where(eq(habitMetrics.userId, userId));
  } catch (e) {
    console.error("Streak update failed:", e);
  }
};

// ─────────────────────────────────────────────
// HELPER: Goal updater
// ─────────────────────────────────────────────

const handleGoalAction = async (
  userId: string,
  goalName: string,
  goalAmount: number,
  today: string
) => {
  await db.insert(goals).values({
    userId,
    name: goalName,
    targetAmount: goalAmount.toString(),
    currentAmount: "0",
    desiredDate: null,
    createdAt: new Date(),
  });
};

// ─────────────────────────────────────────────
// HELPER: Budget setter
// ─────────────────────────────────────────────

const handleBudgetAction = async (
  userId: string,
  budgetCategory: string,
  budgetLimit: number,
  userCategories: any[]
) => {
  const match = userCategories.find(
    (c) =>
      c.name.toLowerCase() === budgetCategory.toLowerCase() ||
      budgetCategory.toLowerCase().includes(c.name.toLowerCase())
  );
  if (!match) return;

  // Upsert: check if budget exists
  const existing = await db
    .select()
    .from(budgets)
    .where(
      and(eq(budgets.userId, userId), eq(budgets.categoryId, match.id))
    );

  if (existing.length > 0) {
    await db
      .update(budgets)
      .set({ limitAmount: budgetLimit.toString() })
      .where(
        and(eq(budgets.userId, userId), eq(budgets.categoryId, match.id))
      );
  } else {
    await db.insert(budgets).values({
      userId,
      categoryId: match.id,
      limitAmount: budgetLimit.toString(),
      period: "monthly",
    });
  }
};

// ─────────────────────────────────────────────
// MAIN CHAT HANDLER
// ─────────────────────────────────────────────

export const chatWithCoach = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Please log in again." });
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    const dates = getDateRange();

    // ── 1. Run Full Analytics (single parallel fetch) ──
    const analytics = await runFullAnalytics(userId);

    // ── 2. Fetch Categories ──
    const userCategories = await db
      .select()
      .from(categories)
      .where(or(isNull(categories.userId), eq(categories.userId, userId)));

    const categoryNames =
      userCategories.length > 0
        ? userCategories.map((c) => c.name).join(", ")
        : "Food, Groceries, Transport, Shopping, Bills, Salary, Income, Entertainment, Health, Education";

    // ── 3. Fetch Chat History (last 12 messages for context) ──
    const historyData = await db
      .select()
      .from(aiChatHistory)
      .where(eq(aiChatHistory.userId, userId))
      .orderBy(desc(aiChatHistory.timestamp))
      .limit(12);

    const chatHistory = historyData.reverse().map((h) => ({
      role: (h.role === "assistant" ? "assistant" : "user") as
        | "assistant"
        | "user",
      content: h.message,
    }));

    // ── 4. Build System Prompt with Analytics Context ──
    const analyticsSummary = buildAnalyticsSummary(analytics);
    const systemPrompt = buildSystemPrompt(
      analyticsSummary,
      categoryNames,
      dates.today
    );

    // ── 5. Call LLM ──
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: message },
      ],
      temperature: 0.15,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";

    let aiData: AIResponse;
    try {
      aiData = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("LLM JSON parse failure:", rawContent);
      return res.status(500).json({
        error: "I got confused for a second. Could you rephrase that?",
      });
    }

    const coachReply = aiData.reply || "Got it. Anything else?";

    // ── 6. Execute Actions ──
    let newTx = null;
    let newGoal = null;
    let updatedBudget = null;

    // ── ADD_TX: Log a transaction ──
    if (
      aiData.action === "ADD_TX" &&
      aiData.amount !== null &&
      aiData.amount !== undefined
    ) {
      // Match category
      let matchedCategoryId: string | null = null;
      if (aiData.category) {
        const aiCat = aiData.category.toLowerCase().trim();
        const match = userCategories.find(
          (c) =>
            c.name.toLowerCase() === aiCat ||
            aiCat.includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(aiCat)
        );
        if (match) matchedCategoryId = match.id;
      }

      [newTx] = await db
        .insert(transactions)
        .values({
          userId,
          amount: aiData.amount.toString(),
          type: aiData.type || "expense",
          categoryId: matchedCategoryId,
          intent: aiData.intent || null,
          paymentMode: aiData.paymentMode || "cash",
          note: aiData.note || aiData.category || "",
          source: "ai",
          date: dates.today,
        })
        .returning();

      // Update streak on any logged transaction
      await updateHabitStreak(userId, dates.today);
    }

    // ── UPDATE_GOAL: Create or update a savings goal ──
    if (
      aiData.action === "UPDATE_GOAL" &&
      aiData.goalName &&
      aiData.goalAmount
    ) {
      await handleGoalAction(
        userId,
        aiData.goalName,
        aiData.goalAmount,
        dates.today
      );
      newGoal = { name: aiData.goalName, targetAmount: aiData.goalAmount };
    }

    // ── SET_BUDGET: Create or update category budget ──
    if (
      aiData.action === "SET_BUDGET" &&
      aiData.budgetCategory &&
      aiData.budgetLimit
    ) {
      await handleBudgetAction(
        userId,
        aiData.budgetCategory,
        aiData.budgetLimit,
        userCategories
      );
      updatedBudget = {
        category: aiData.budgetCategory,
        limit: aiData.budgetLimit,
      };
    }

    // ── 7. Log conversation ──
    await db.insert(aiChatHistory).values([
      { userId, role: "user", message },
      { userId, role: "assistant", message: coachReply },
    ]);

    // ── 8. Fetch updated analytics for frontend refresh ──
    // Reuse the same analytics object — no need for a second DB hit.
    // If a transaction was just logged, the snapshot values are still
    // directionally correct for immediate UI feedback.
    const freshAlerts = analytics.alerts;

    // ── 9. Build Response ──
    return res.json({
      text: coachReply,
      action: aiData.action,
      transaction: newTx,
      goal: newGoal,
      budget: updatedBudget,
      // Attach key analytics for frontend to refresh without separate call
      snapshot: {
        savingsRate: analytics.stats.savingsRate,
        disciplineScore: analytics.behavior.disciplineScore,
        totalExpense: analytics.stats.totalExpense,
        totalIncome: analytics.stats.totalIncome,
        wantsRemaining: analytics.budget.wantsLimit - analytics.stats.totalWants,
        needsRemaining: analytics.budget.needsLimit - analytics.stats.totalNeeds,
        alerts: freshAlerts.slice(0, 5),
        prediction: analytics.prediction,
      },
    });
  } catch (error) {
    console.error("Habit Coach Error:", error);
    return res.status(500).json({
      error: "Your coach is catching their breath. Try again in a moment!",
    });
  }
};

// ─────────────────────────────────────────────
// GET ANALYTICS DASHBOARD
// ─────────────────────────────────────────────

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const analytics = await runFullAnalytics(userId);

    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ error: "Failed to load dashboard." });
  }
};

// ─────────────────────────────────────────────
// GET COACHING INSIGHTS (standalone)
// ─────────────────────────────────────────────

export const getCoachingInsights = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const analytics = await runFullAnalytics(userId);

    return res.json({
      success: true,
      insights: analytics.coachingInsights,
      optimizedBudget: analytics.optimizedBudget,
      disciplineScore: analytics.behavior.disciplineScore,
      disciplineLabel: analytics.behavior.disciplineLabel,
      topWeaknesses: analytics.behavior.topWeaknesses,
    });
  } catch (error) {
    console.error("Insights error:", error);
    return res.status(500).json({ error: "Failed to load insights." });
  }
};

// ─────────────────────────────────────────────
// GET ALERTS
// ─────────────────────────────────────────────

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const analytics = await runFullAnalytics(userId);

    return res.json({
      success: true,
      alerts: analytics.alerts,
      // Color-coded summary counts
      summary: {
        red: analytics.alerts.filter((a) => a.severity === "red").length,
        yellow: analytics.alerts.filter((a) => a.severity === "yellow").length,
        green: analytics.alerts.filter((a) => a.severity === "green").length,
      },
    });
  } catch (error) {
    console.error("Alerts error:", error);
    return res.status(500).json({ error: "Failed to load alerts." });
  }
};

// ─────────────────────────────────────────────
// GET WEEKLY REPORT
// ─────────────────────────────────────────────

export const getWeeklyReportEndpoint = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const analytics = await runFullAnalytics(userId);

    return res.json({
      success: true,
      report: analytics.weeklyReport,
      coachingInsights: analytics.coachingInsights,
    });
  } catch (error) {
    console.error("Weekly report error:", error);
    return res.status(500).json({ error: "Failed to generate weekly report." });
  }
};

// ─────────────────────────────────────────────
// UPDATE BUDGET / GOALS
// ─────────────────────────────────────────────

export const updateBudget = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const { categoryId, limitAmount } = req.body;
    if (!categoryId || !limitAmount) {
      return res.status(400).json({ error: "categoryId and limitAmount required." });
    }

    const existing = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, categoryId)));

    if (existing.length > 0) {
      await db
        .update(budgets)
        .set({ limitAmount: limitAmount.toString() })
        .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, categoryId)));
    } else {
      await db.insert(budgets).values({
        userId,
        categoryId,
        limitAmount: limitAmount.toString(),
        period: "monthly",
      });
    }

    return res.json({ success: true, message: "Budget updated successfully." });
  } catch (error) {
    console.error("Update budget error:", error);
    return res.status(500).json({ error: "Failed to update budget." });
  }
};

export const updateGoal = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const { name, targetAmount, desiredDate } = req.body;
    if (!name || !targetAmount) {
      return res.status(400).json({ error: "name and targetAmount required." });
    }

    const [newGoal] = await db
      .insert(goals)
      .values({
        userId,
        name,
        targetAmount: targetAmount.toString(),
        currentAmount: "0",
        desiredDate: desiredDate ?? null,
      })
      .returning();

    return res.json({ success: true, goal: newGoal });
  } catch (error) {
    console.error("Update goal error:", error);
    return res.status(500).json({ error: "Failed to create goal." });
  }
};

// ─────────────────────────────────────────────
// ADD EXPENSE (Manual REST endpoint)
// ─────────────────────────────────────────────

export const addExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const { amount, type, categoryId, intent, paymentMode, note, date, isRecurring } = req.body;

    if (!amount || !type || !date) {
      return res.status(400).json({ error: "amount, type, and date are required." });
    }

    const [newTx] = await db
      .insert(transactions)
      .values({
        userId,
        amount: amount.toString(),
        type,
        categoryId: categoryId ?? null,
        intent: intent ?? null,
        paymentMode: paymentMode ?? "cash",
        note: note ?? "",
        source: "manual",
        date,
        isRecurring: isRecurring ?? false,
      })
      .returning();

    // Update streak
    await updateHabitStreak(userId, date);

    // Return updated analytics snapshot
    const analytics = await runFullAnalytics(userId);

    return res.json({
      success: true,
      transaction: newTx,
      snapshot: {
        savingsRate: analytics.stats.savingsRate,
        alerts: analytics.alerts.slice(0, 3),
        prediction: analytics.prediction,
      },
    });
  } catch (error) {
    console.error("Add expense error:", error);
    return res.status(500).json({ error: "Failed to add transaction." });
  }
};