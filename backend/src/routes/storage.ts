// backend/storage.ts
import { eq, and, desc, or, isNull, sql } from "drizzle-orm";
import { db } from "../db/index"; 
import bcrypt from "bcrypt"; // Import bcrypt
import { 
  users, 
  categories, 
  transactions, 
  goals, 
  aiChatHistory, 
  budgets, 
  habitMetrics, 
  recurringConfigs, 
  financialProfiles,
  appNotifications,
} from "../db/schema";


import { monthlySummaries, monthlyCategorySummaries, behaviorAggregates } from "../db/schema";
type NewGoal = typeof goals.$inferInsert;
type NewChatMessage = typeof aiChatHistory.$inferInsert;
type NewTransaction = typeof transactions.$inferInsert;
type NewRecurring = typeof recurringConfigs.$inferInsert;
type NewUser = typeof users.$inferInsert; // Added for User creation

export const Storage = {

  // --- User Management (Password/JWT Based) ---
  createUser: async (userData: NewUser) => {
    // Hash the password before saving
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    const [newUser] = await db.insert(users)
      .values({ 
        name: userData.name,
        email: userData.email, 
        password: hashedPassword 
      })
      .returning({ 
        id: users.id, 
        email: users.email, 
        name: users.name 
      }); // We intentionally don't return the password hash
      
    return newUser;
  },

  getUserByEmail: async (email: string) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  getUserById: async (id: string) => {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  savePushToken: async (userId: string, expoPushToken: string) => {
    const [user] = await db.update(users)
      .set({ expoPushToken })
      .where(eq(users.id, userId))
      .returning();
    return user;
  },

  // --- Categories ---
  getCategories: async (userId: string, type: 'income' | 'expense' | 'transfer') => {
    return await db.select()
      .from(categories)
      .where(
        and(
          eq(categories.type, type),
          or(
            eq(categories.userId, userId),
            isNull(categories.userId) // Includes defaults
          )
        )
      );
  },

  // --- Goals (Wishlist) ---
  getGoals: async (userId: string) => {
    return await db.select().from(goals).where(eq(goals.userId, userId));
  },

  createGoal: async (goalData: NewGoal) => {
    const [newGoal] = await db.insert(goals).values(goalData).returning();
    return newGoal;
  },

  updateGoalProgress: async (goalId: string, userId: string, addedAmount: number) => {
    const goal = await db.query.goals.findFirst({ 
      where: and(
        eq(goals.id, goalId), 
        eq(goals.userId, userId) 
      ) 
    });

    if (goal) {
      const newAmount = Number(goal.currentAmount || 0) + addedAmount;
      const [updated] = await db.update(goals)
        .set({ currentAmount: newAmount.toString() })
        .where(eq(goals.id, goalId)) 
        .returning();
        
      return updated;
    }
    
    throw new Error("Goal not found or unauthorized");
  },
  
  // --- Recurring Configs ---
  getRecurringConfigs: async (userId: string) => {
    return await db.select()
      .from(recurringConfigs)
      .where(eq(recurringConfigs.userId, userId));
  },

  addRecurringConfig: async (configData: NewRecurring) => {
    const [newConfig] = await db.insert(recurringConfigs)
      .values(configData)
      .returning();
    return newConfig;
  },
  
  // --- AI Context & Chat History ---
  getRecentLogsForAI: async (userId: string, daysBack: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    return await db.select({
      amount: transactions.amount,
      type: transactions.type,
      intent: transactions.intent,
      date: transactions.date,
      note: transactions.note,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.date} >= ${cutoffDate.toISOString().split('T')[0]}`
      )
    )
    .orderBy(desc(transactions.date));
  },

  getChatHistory: async (userId: string) => {
    return await db.select()
      .from(aiChatHistory)
      .where(eq(aiChatHistory.userId, userId))
      .orderBy(aiChatHistory.timestamp);
  },

  addChatMessage: async (messageData: NewChatMessage) => {
    const [newMessage] = await db.insert(aiChatHistory).values(messageData).returning();
    return newMessage;
  },

  // --- Transactions ---
  getTransactions: async (userId: string) => {
    return await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        note: transactions.note,
        date: transactions.date,
        paymentMode: transactions.paymentMode,
        intent: transactions.intent,
        debtType: transactions.debtType,
        debtContact: transactions.debtContact,
        categoryName: categories.name, 
        categoryIcon: categories.icon,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date), desc(transactions.createdAt));
  },

  // --- Replace your existing addTransaction with this ---
  addTransaction: async (txData: NewTransaction) => {
    return await db.transaction(async (tx) => {
      // 1. Insert the transaction
      const [newTx] = await tx.insert(transactions).values(txData).returning();

      // 2. Setup variables for rollups
      const d = new Date(txData.date);
      const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amt = Number(txData.amount);
      const isExpense = txData.type === 'expense';
      const isIncome = txData.type === 'income';

      // 3. Rollup: Monthly Summaries
      await tx.insert(monthlySummaries)
        .values({
          userId: txData.userId,
          monthYear,
          totalIncome: isIncome ? String(amt) : "0",
          totalExpense: isExpense ? String(amt) : "0",
          totalSavings: isIncome ? String(amt) : (isExpense ? String(-amt) : "0")
        })
        .onConflictDoUpdate({
          target: [monthlySummaries.userId, monthlySummaries.monthYear],
          set: {
            totalIncome: sql`${monthlySummaries.totalIncome} + ${isIncome ? amt : 0}`,
            totalExpense: sql`${monthlySummaries.totalExpense} + ${isExpense ? amt : 0}`,
            totalSavings: sql`${monthlySummaries.totalSavings} + ${isIncome ? amt : (isExpense ? -amt : 0)}`
          }
        });

      // 4. Rollup: Categories (Only if expense and has a category)
      if (isExpense && txData.categoryId) {
        await tx.insert(monthlyCategorySummaries)
          .values({
            userId: txData.userId,
            categoryId: txData.categoryId,
            monthYear,
            totalAmount: String(amt)
          })
          .onConflictDoUpdate({
            target: [monthlyCategorySummaries.userId, monthlyCategorySummaries.categoryId, monthlyCategorySummaries.monthYear],
            set: { totalAmount: sql`${monthlyCategorySummaries.totalAmount} + ${amt}` }
          });
      }

      // 5. Rollup: Behaviors (Needs vs Wants)
      if (isExpense && (txData.intent === 'need' || txData.intent === 'want')) {
        const isWant = txData.intent === 'want';
        const isNeed = txData.intent === 'need';
        await tx.insert(behaviorAggregates)
          .values({
            userId: txData.userId,
            monthYear,
            wantSpendTotal: isWant ? String(amt) : "0",
            needSpendTotal: isNeed ? String(amt) : "0"
          })
          .onConflictDoUpdate({
            target: [behaviorAggregates.userId, behaviorAggregates.monthYear],
            set: {
              wantSpendTotal: sql`${behaviorAggregates.wantSpendTotal} + ${isWant ? amt : 0}`,
              needSpendTotal: sql`${behaviorAggregates.needSpendTotal} + ${isNeed ? amt : 0}`
            }
          });
      }

      return newTx;
    });
  },

  // --- ADD THIS NEW METHOD ---
  getDashboard: async (userId: string) => {
    const d = new Date();
    const currentMonthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // 1. Get Monthly Stats
    const [monthStats] = await db.select()
      .from(monthlySummaries)
      .where(and(eq(monthlySummaries.userId, userId), eq(monthlySummaries.monthYear, currentMonthYear)));

    // 2. Get Top Categories for this month
    const categoryStats = await db.select({
        categoryName: categories.name,
        total: monthlyCategorySummaries.totalAmount,
      })
      .from(monthlyCategorySummaries)
      .leftJoin(categories, eq(monthlyCategorySummaries.categoryId, categories.id))
      .where(and(eq(monthlyCategorySummaries.userId, userId), eq(monthlyCategorySummaries.monthYear, currentMonthYear)))
      .orderBy(desc(monthlyCategorySummaries.totalAmount))
      .limit(6);

    // Calculate percentages
    const totalExp = Number(monthStats?.totalExpense || 0);
    const categoryBreakdown = categoryStats.map(c => ({
      categoryName: c.categoryName || 'Unknown',
      total: Number(c.total),
      percentOfExpense: totalExp > 0 ? (Number(c.total) / totalExp) * 100 : 0
    }));

    // 3. Get Behavior Stats
    const [behavior] = await db.select()
      .from(behaviorAggregates)
      .where(and(eq(behaviorAggregates.userId, userId), eq(behaviorAggregates.monthYear, currentMonthYear)));

    const wantTotal = Number(behavior?.wantSpendTotal || 0);
    const impulseScore = totalExp > 0 ? 100 - ((wantTotal / totalExp) * 100) : 100;

    return {
      stats: {
        totalIncome: Number(monthStats?.totalIncome || 0),
        totalExpense: totalExp,
      },
      categoryBreakdown,
      behavior: {
        disciplineScore: impulseScore > 50 ? 85 : 45, // Basic calculation based on wants
        impulseBuyingScore: impulseScore,
        emotionalSpendingScore: 50,
        weekendOverspendRatio: 1.0,
        lateNightSpendPercent: 10,
        subscriptionEstimate: 0
      },
      dailyAverages: {
        daily: totalExp / d.getDate(),
        weekly: (totalExp / d.getDate()) * 7
      },
      prediction: {
        projectedMonthlyExpense: (totalExp / d.getDate()) * 30
      }
    };
  },
  
  // --- Financial Profile ---
  upsertFinancialProfile: async (profileData: any) => {
    const { userId, ...data } = profileData;
    
    const [profile] = await db.insert(financialProfiles)
      .values({
        userId,
        baseIncome: String(data.baseIncome),
        fixedNeeds: String(data.fixedNeeds),
        targetSavingsGoal: String(data.targetSavingsGoal),
        spendingWeakness: data.spendingWeakness,
        primaryGoal: data.primaryGoal,
      })
      .onConflictDoUpdate({
        target: financialProfiles.userId,
        set: {
          baseIncome: String(data.baseIncome),
          fixedNeeds: String(data.fixedNeeds),
          targetSavingsGoal: String(data.targetSavingsGoal),
          spendingWeakness: data.spendingWeakness,
          primaryGoal: data.primaryGoal,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  },

  getFinancialProfile: async (userId: string) => {
    return await db.query.financialProfiles.findFirst({
      where: eq(financialProfiles.userId, userId),
    });
  },


  // --- REPORTS GENERATOR (NEW) ---
  getReportData: async (userId: string) => {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // 1. Get Monthly Summaries (Current & Last)
    const [currentSummary] = await db.select().from(monthlySummaries)
      .where(and(eq(monthlySummaries.userId, userId), eq(monthlySummaries.monthYear, currentMonthStr)));
      
    const [lastSummary] = await db.select().from(monthlySummaries)
      .where(and(eq(monthlySummaries.userId, userId), eq(monthlySummaries.monthYear, lastMonthStr)));

    // Parse core numbers
    const income = Number(currentSummary?.totalIncome || 0);
    const expenses = Number(currentSummary?.totalExpense || 0);
    const savings = Number(currentSummary?.totalSavings || 0);
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

    const lastExpenses = Number(lastSummary?.totalExpense || 0);
    const lastIncome = Number(lastSummary?.totalIncome || 0);
    const lastSavings = Number(lastSummary?.totalSavings || 0);
    const lastSavingsRate = lastIncome > 0 ? Math.round((lastSavings / lastIncome) * 100) : 0;

    const expenseDiff = expenses - lastExpenses;
    const savingsRateDiff = savingsRate - lastSavingsRate;

    // 2. Get Top Categories
    const topCatsData = await db.select({
      name: categories.name,
      total: monthlyCategorySummaries.totalAmount
    })
    .from(monthlyCategorySummaries)
    .innerJoin(categories, eq(monthlyCategorySummaries.categoryId, categories.id))
    .where(and(eq(monthlyCategorySummaries.userId, userId), eq(monthlyCategorySummaries.monthYear, currentMonthStr)))
    .orderBy(desc(monthlyCategorySummaries.totalAmount))
    .limit(3);

    const topCategories = topCatsData.map(c => ({
      name: c.name || 'Unknown',
      total: Number(c.total),
      percent: expenses > 0 ? Math.round((Number(c.total) / expenses) * 100) : 0
    }));

    // Generate Reality Check Insights
    const realityCheck = [];
    if (expenseDiff > 0 && lastExpenses > 0) realityCheck.push(`You spent ₹${expenseDiff.toLocaleString('en-IN')} more than last month.`);
    else if (expenseDiff < 0) realityCheck.push(`Great! You spent ₹${Math.abs(expenseDiff).toLocaleString('en-IN')} less than last month.`);
    
    if (savingsRateDiff > 0) realityCheck.push(`Savings improved by ${savingsRateDiff}% compared to last month.`);
    else if (savingsRateDiff < 0) realityCheck.push(`Savings dropped ${Math.abs(savingsRateDiff)}% vs last month.`);
    
    if (topCategories.length > 0) {
      realityCheck.push(`Major leak: ${topCategories[0].name} is eating up ${topCategories[0].percent}% of your expenses.`);
    }

    // 3. Get Budgets vs Actuals
    // Join budgets with the current month's category summary
    const budgetData = await db.select({
      name: categories.name,
      limit: budgets.limitAmount,
      spent: monthlyCategorySummaries.totalAmount
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .leftJoin(monthlyCategorySummaries, and(
      eq(monthlyCategorySummaries.categoryId, budgets.categoryId),
      eq(monthlyCategorySummaries.userId, userId),
      eq(monthlyCategorySummaries.monthYear, currentMonthStr)
    ))
    .where(eq(budgets.userId, userId));

    let totalBudgetLimit = 0;
    let totalBudgetSpent = 0;
    let worstOverspend = { name: '', diff: 0, percent: 0 };
    let bestUnderbudget = { name: '', diff: 0 };
    let underBudgetCount = 0;

    const budgetCategories = budgetData.map(b => {
      const limit = Number(b.limit);
      const spent = Number(b.spent || 0);
      const diff = spent - limit;
      const status = diff > 0 ? "over" : "under";
      
      totalBudgetLimit += limit;
      totalBudgetSpent += spent;

      if (status === 'over') {
        const overPct = Math.round((diff / limit) * 100);
        if (diff > worstOverspend.diff) worstOverspend = { name: b.name || '', diff, percent: overPct };
      } else {
        underBudgetCount++;
        if (Math.abs(diff) > bestUnderbudget.diff) bestUnderbudget = { name: b.name || '', diff: Math.abs(diff) };
      }

      return { name: b.name, limit, spent, diff: Math.abs(diff), status };
    });

    const overallUtilization = totalBudgetLimit > 0 ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100) : 0;

    // Generate Budget Insights
    const budgetInsights = [];
    if (worstOverspend.name) budgetInsights.push(`You exceeded your ${worstOverspend.name} budget by ${worstOverspend.percent}%.`);
    if (bestUnderbudget.name) budgetInsights.push(`You saved ₹${bestUnderbudget.diff.toLocaleString('en-IN')} in ${bestUnderbudget.name}!`);
    if (budgetCategories.length > 0) budgetInsights.push(`Stayed within budget in ${underBudgetCount} out of ${budgetCategories.length} tracked categories.`);

    return {
      month: monthName,
      monthlyReport: {
        income, expenses, savings, savingsRate,
        vsLastMonth: { expenseDiff, savingsRateDiff },
        topCategories,
        realityCheck: realityCheck.length ? realityCheck : ["Log more transactions to see your reality check."]
      },
      budgetReport: {
        overallUtilization,
        topProblemArea: worstOverspend.name || "None! You're doing great.",
        categories: budgetCategories,
        insights: budgetInsights.length ? budgetInsights : ["Set up budgets to get insights here."]
      }
    };
  },

createNotification: async (data: { userId: string; title: string; message: string }) => {
    const [notification] = await db.insert(appNotifications)
      .values({
        userId: data.userId,
        title: data.title,
        message: data.message,
        isRead: false,
        // createdAt should be handled automatically by your schema, 
        // but you can add it here if needed: date: new Date().toISOString()
      })
      .returning();
    return notification;
  },
  

 getNotifications: async (userId: string) => {
    return await db.select()
      .from(appNotifications)
      .where(eq(appNotifications.userId, userId))
      .orderBy(desc(appNotifications.createdAt));
  }
};