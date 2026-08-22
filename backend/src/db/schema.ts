import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  boolean,
  pgEnum,
  date,
  integer,
  unique
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- ENUMS ---
export const frequencyEnum = pgEnum("frequency", ["daily", "weekly", "monthly", "yearly"]);
export const typeEnum = pgEnum("type", ["income", "expense", "transfer"]);
export const intentEnum = pgEnum("intent", ["need", "want"]);
export const sourceEnum = pgEnum("source", ["manual", "ai", "system"]);
export const roleEnum = pgEnum("role", ["user", "assistant"]);
export const paymentModeEnum = pgEnum("payment_mode", ["cash", "card", "upi", "bank_transfer", "other"]);
export const debtTypeEnum = pgEnum("debt_type", ["none", "i_owe", "owes_me"]);


export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(), // This will store the bcrypt hash
  expoPushToken: text('expo_push_token'),
  createdAt: timestamp('created_at').defaultNow(),
});



// 2. Financial Profiles (The AI Coaching Context)
export const financialProfiles = pgTable("financial_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  baseIncome: decimal("base_income", { precision: 12, scale: 2 }).default("0"),
  fixedNeeds: decimal("fixed_needs", { precision: 12, scale: 2 }).default("0"), 
  targetSavingsGoal: decimal("target_savings_goal", { precision: 12, scale: 2 }).default("0"),
  spendingWeakness: text("spending_weakness"), 
  primaryGoal: text("primary_goal"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 3. Categories
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: typeEnum("type").notNull(),
  icon: text("icon").notNull(),
  color: text("color").default("#000000"),
  isCustom: boolean("is_custom").default(false),
  userId: text("user_id").references(() => users.id), 
});

// 4. Transactions
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
 userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  type: typeEnum("type").notNull(),
  paymentMode: paymentModeEnum("payment_mode").default("cash").notNull(),
  debtType: debtTypeEnum("debt_type").default("none").notNull(),
  debtContact: text("debt_contact"), 
  intent: intentEnum("intent"),
  source: sourceEnum("source").default("manual"),
  note: text("note"),
  date: date("date").notNull(),
  isRecurring: boolean("is_recurring").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// 5. Recurring Rules
export const recurringConfigs = pgTable("recurring_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  categoryId: uuid("category_id").references(() => categories.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: typeEnum("type").notNull(), 
  frequency: frequencyEnum("frequency").notNull(), 
  nextDate: date("next_date").notNull(), 
  isActive: boolean("is_active").default(true),
});

// 6. Saving Goals (Wishlist)
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).default("0"),
  desiredDate: date("desired_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 7. Budgets
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  limitAmount: decimal("limit_amount", { precision: 12, scale: 2 }).notNull(),
  hasNotified80: boolean("has_notified_80").default(false),
  period: text("period").default("monthly"),
});

// 8. Habit Metrics
export const habitMetrics = pgTable("habit_metrics", {
  userId: text("user_id").primaryKey().references(() => users.id),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastLoggedAt: date("last_logged_at"),
});

// 9. AI Chat History
export const aiChatHistory = pgTable("ai_chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  role: roleEnum("role").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// 10. App Notifications
export const appNotifications = pgTable("app_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- RELATIONS ---

export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  categories: many(categories),
  goals: many(goals),
  budgets: many(budgets),
  appNotifications: many(appNotifications),
  habitMetrics: one(habitMetrics, {
    fields: [users.id],
    references: [habitMetrics.userId],
  }),
  financialProfile: one(financialProfiles, {
    fields: [users.id],
    references: [financialProfiles.userId],
  }),
}));

export const financialProfilesRelations = relations(financialProfiles, ({ one }) => ({
  user: one(users, { fields: [financialProfiles.userId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));

export const appNotificationsRelations = relations(appNotifications, ({ one }) => ({
  user: one(users, { fields: [appNotifications.userId], references: [users.id] }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const monthlySummaries = pgTable("monthly_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  monthYear: text("month_year").notNull(), // Format: 'YYYY-MM'
  totalIncome: decimal("total_income", { precision: 12, scale: 2 }).default("0"),
  totalExpense: decimal("total_expense", { precision: 12, scale: 2 }).default("0"),
  totalSavings: decimal("total_savings", { precision: 12, scale: 2 }).default("0"),
}, (t) => ({
  unqUserMonth: unique().on(t.userId, t.monthYear), 
}));

export const monthlyCategorySummaries = pgTable("monthly_category_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  monthYear: text("month_year").notNull(), // Format: 'YYYY-MM'
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).default("0"),
}, (t) => ({
  unqUserCategoryMonth: unique().on(t.userId, t.categoryId, t.monthYear),
}));

export const behaviorAggregates = pgTable("behavior_aggregates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  monthYear: text("month_year").notNull(), // Format: 'YYYY-MM'
  needSpendTotal: decimal("need_spend_total", { precision: 12, scale: 2 }).default("0"),
  wantSpendTotal: decimal("want_spend_total", { precision: 12, scale: 2 }).default("0"),
}, (t) => ({
  unqUserBehaviorMonth: unique().on(t.userId, t.monthYear),
}));