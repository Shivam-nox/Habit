// backend/routes.ts
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Storage } from './storage';
import { sendPushNotification } from '../utils/push';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined');
}

// ==========================================
// 1. CUSTOM JWT MIDDLEWARE
// ==========================================
export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthenticated. Missing token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { userId: string };
    (req as any).userId = decoded.userId; 
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthenticated. Invalid or expired token.' });
  }
};

// ==========================================
// 2. AUTH ROUTES (Email & Password)
// ==========================================

// --- REGISTER ---
router.post('/auth/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await Storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Create the user
    const newUser = await Storage.createUser({ email, password, name });

    // Generate JWT
    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ token, user: newUser });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// --- LOGIN ---
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // 1. Find user by email
    const user = await Storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 2. Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 3. Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    // 4. Send response (omitting the password hash)
    res.status(200).json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name } 
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- PUSH TOKEN ---
router.post('/auth/push-token', requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Push token is required' });
  }
  try {
    await Storage.savePushToken(userId, token);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Save Push Token Error:", error);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

// ==========================================
// 3. APPLICATION ROUTES
// ==========================================

router.get('/categories/:type', requireAuth, async (req: express.Request, res: express.Response) => {
  const { type } = req.params;
  const userId = (req as any).userId;

  if (type !== 'income' && type !== 'expense' && type !== 'transfer') {
    res.status(400).json({ error: 'Invalid type' });
    return;
  }

  try {
    const data = await Storage.getCategories(userId, type as 'income' | 'expense' | 'transfer');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/transactions', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  try {
    const data = await Storage.getTransactions(userId);
    res.json(data);
  } catch (e) {
    console.error("GET Transactions Error:", e);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/transactions', requireAuth, async (req: express.Request, res: express.Response) => {
  console.log("🚀 [DEBUG] /transactions route hit!");
  console.log("📦 [DEBUG] Request Body:", req.body);
  
  const userId = (req as any).userId;
  console.log("👤 [DEBUG] User ID:", userId);

  const { 
    amount, type, categoryName, note, date, 
    intent, paymentMode, debtType, debtContact 
  } = req.body;

  if (!amount || !type) {
    console.log("❌ [DEBUG] Validation Failed: Missing amount or type");
    res.status(400).json({ error: 'Missing required fields (amount, type)' });
    return;
  }

  try {
    let realCategoryId = null;
    if (categoryName) {
      console.log(`🔍 [DEBUG] Looking up category: ${categoryName}`);
      const categoriesList = await Storage.getCategories(userId, type);
      const matchedCategory = categoriesList.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

      if (matchedCategory) {
        realCategoryId = matchedCategory.id;
        console.log(`✅ [DEBUG] Found Category ID: ${realCategoryId}`);
      } else {
        console.log(`❌ [DEBUG] Category '${categoryName}' not found in database.`);
        res.status(400).json({ error: `Category '${categoryName}' not found.` });
        return;
      }
    }

    console.log("💾 [DEBUG] Attempting to save transaction...");
    const tx = await Storage.addTransaction({
      userId,
      amount: String(amount), 
      type,
      categoryId: realCategoryId,
      paymentMode: paymentMode || 'cash',
      debtType: debtType || 'none',
      debtContact: debtType !== 'none' ? debtContact : null,
      intent, 
      note,
      date: date || new Date().toISOString(),
      source: 'manual',
    });
    console.log("✅ [DEBUG] Transaction saved successfully:", tx.id);

    // --- NOTIFICATION LOGIC ---
    const notifTitle = "Record Added 🚀";
    const notifMessage = `Successfully added ${type} of ${amount}`;

    console.log("🔔 [DEBUG] Fetching user for push token...");
    const user = await Storage.getUserById(userId);
    
    if (user?.expoPushToken) {
      console.log("📱 [DEBUG] Sending Expo Push to:", user.expoPushToken);
      sendPushNotification(
        userId,
        user.expoPushToken,
        notifTitle,
        notifMessage
      ).catch(e => console.error("❌ [DEBUG] Push Notification Error:", e));
    } else {
      console.log("⚠️ [DEBUG] No expoPushToken found for user");
    }

    console.log("📥 [DEBUG] Saving to appNotifications table...");
    try {
      await Storage.createNotification({
        userId,
        title: notifTitle,
        message: notifMessage
      });
      console.log("✅ [DEBUG] App Notification saved");
    } catch (notifError) {
      console.error("❌ [DEBUG] Failed to save app notification:", notifError);
    }
    // --------------------------

    console.log("🏁 [DEBUG] Sending success response to frontend");
    res.status(201).json(tx);
  } catch (e) {
    console.error("❌ [DEBUG] FATAL Transaction Route Error:", e);
    res.status(500).json({ error: 'Transaction failed to save' });
  }
});


router.get('/dashboard', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  try {
    // This will now fetch instantly using your rollup tables!
    const data = await Storage.getDashboard(userId);
    res.json({ success: true, data });
  } catch (e) {
    console.error("GET Dashboard Error:", e);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/recurring', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  try {
    const data = await Storage.getRecurringConfigs(userId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch recurring payments' });
  }
});

router.post('/recurring', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const { amount, type, interval, frequency, nextDate } = req.body;

  const actualFrequency = frequency || interval;

  if (!amount || !type || !actualFrequency || !nextDate) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    const newRecurring = await Storage.addRecurringConfig({
      userId,
      amount: String(amount),
      type,
      frequency: actualFrequency,
      nextDate,
      isActive: true,
    });
    
    // Trigger push notification
    const user = await Storage.getUserById(userId);
    if (user?.expoPushToken) {
      await sendPushNotification(
        userId,
        user.expoPushToken,
        "Recurring Payment Set 📅",
        `Successfully set up ${type} of ${amount} for ${actualFrequency}`
      );
    }
    
    res.status(201).json(newRecurring);
  } catch (e) {
    console.error("Recurring Route Error:", e);
    res.status(500).json({ error: 'Failed to create recurring payment' });
  }
});

router.get('/goals', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  try {
    const data = await Storage.getGoals(userId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

router.post('/goals', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const { name, targetAmount, desiredDate } = req.body;

  if (!name || !targetAmount) {
    res.status(400).json({ error: 'Name and target amount are required' });
    return;
  }

  try {
    const newGoal = await Storage.createGoal({
      userId,
      name,
      targetAmount: String(targetAmount),
      desiredDate: desiredDate || null,
    });
    
    // Trigger push notification
    const user = await Storage.getUserById(userId);
    if (user?.expoPushToken) {
      await sendPushNotification(
        userId,
        user.expoPushToken,
        "Goal Created 🎯",
        `Your goal "${name}" for ${targetAmount} has been created.`
      );
    }
    
    res.status(201).json(newGoal);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.post('/goals/:id/allocate', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string; 
  const id = req.params.id as string; 
  const { amount } = req.body; 

  try {
    const updatedGoal = await Storage.updateGoalProgress(id, userId, Number(amount));
    
    // Trigger push notification
    const user = await Storage.getUserById(userId);
    if (user?.expoPushToken) {
      await sendPushNotification(
        userId,
        user.expoPushToken,
        "Funds Allocated 💰",
        `You've allocated ${amount} towards a goal.`
      );
    }
    
    res.json(updatedGoal);
  } catch (e: any) {
    res.status(403).json({ error: e.message || 'Failed to update goal progress' });
  }
});

router.get('/chat-history', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId as string;
  try {
    const history = await Storage.getChatHistory(userId);
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

router.get('/reports/generate', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  
  try {
    const reportData = await Storage.getReportData(userId);
    res.json({ success: true, data: reportData });
  } catch (e) {
    console.error("GET Report Data Error:", e);
    res.status(500).json({ error: 'Failed to generate report data' });
  }
});

router.get('/ai-context', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  const { days } = req.query; 
  try {
    const logs = await Storage.getRecentLogsForAI(userId, Number(days) || 30);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch logs for AI' });
  }
});
// backend/routes.ts
router.post('/profile', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  
  try {
   
    const drizzlePayload = {
      userId: userId,
      baseIncome: req.body.base_income?.toString(), // .toString() is safest for Postgres numeric columns
      fixedNeeds: req.body.fixed_needs?.toString(),
      targetSavingsGoal: req.body.target_savings_goal?.toString(),
      spendingWeakness: req.body.spending_weakness,
      primaryGoal: req.body.primary_goal
    };

    const profile = await Storage.upsertFinancialProfile(drizzlePayload);
    res.json(profile);
  } catch (e) {
    console.error("Profile Update Error:", e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/profile', requireAuth, async (req: express.Request, res: express.Response) => {
  const userId = (req as any).userId;
  try {
    const profile = await Storage.getFinancialProfile(userId);
    res.json(profile || null);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get Notifications
router.get('/notifications', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).userId;
    const notifications = await Storage.getNotifications(userId);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
