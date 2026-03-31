import express from 'express';
import cors from 'cors';
import dotenv from "dotenv";

// Import your Drizzle database and schema!
import { db } from './db/index'; 
import { users } from './db/schema'; 



// Import Routes
import  router  from './routes/routes';
import { chatWithCoach } from './routes/chat';
import { requireAuth } from './routes/routes';
// import authRoutes from './routes/auth'; // <-- You will likely need this for your OTP routes

dotenv.config();

const app = express();

// ==========================================
// STANDARD MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json()); // Normal JSON parsing for all routes

// ==========================================
// ROUTES
// ==========================================

// Custom Authentication Routes (e.g., /auth/send-otp, /auth/verify-otp)
// User creation/DB insertion will now happen inside these routes instead of a webhook.
// app.use('/api/auth', authRoutes); 

// Standard App Routes
app.use('/api', router); 
app.post('/api/chat',requireAuth, chatWithCoach);

// ==========================================
// 🛡️ GLOBAL ERROR HANDLER (Prevents App Crashes!)
// ==========================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Backend Error Caught:", err.message);
  
  // Handle custom JWT authentication errors gracefully
  if (err.name === 'UnauthorizedError' || err.message === 'Unauthenticated' || err.statusCode === 401) {
    res.status(401).json({ error: 'Unauthenticated. Invalid or expired token.' });
    return;
  }

  // Catch-all for other server errors
  res.status(500).json({ error: 'Internal Server Error' });
});

// Listening on 0.0.0.0 allows the Android/iOS Emulator to connect
const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});