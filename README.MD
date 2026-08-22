# 💸 Spendly

<p align="center">
    <b>AI-Powered Expense Tracker & Habit Coach</b><br/>
    <em>Take control of your money. Build smarter financial habits.</em>
</p>

<p align="center">
    <img src="https://img.shields.io/badge/Expo-React%20Native-blue?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Backend-Node.js-green?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Database-Neon%20PostgreSQL-purple?style=for-the-badge" />
    <img src="https://img.shields.io/badge/AI-Groq-orange?style=for-the-badge" />
</p>

---

## ✨ Overview

**Spendly** is a premium, AI-powered personal finance tracker designed to help users:

- Track expenses in real time  
- Stay within budget limits  
- Understand spending behavior  
- Get actionable AI-driven insights  

Built with performance and design in mind, Spendly delivers a **smooth, modern UI** combined with a **powerful analytics engine**.

---

## 🏗️ Architecture & Tech Stack

### 📱 Frontend
- React Native (**Expo Router**)
- Custom Premium UI (Teal, Gold & Slate theme)
- `moti` + `react-native-reanimated` for fluid animations
- `expo-print` & `expo-sharing` for PDF exports

### ⚙️ Backend
- Node.js & Express.js
- **Drizzle ORM** (type-safe queries)
- **Neon Serverless PostgreSQL**
- **Groq API** for AI coaching
- JWT Authentication

---

## 🧠 Core Backend Modules

<<<<<<< HEAD
### 📡 Routes (`/src/routes/chat.ts`)
- Handles AI coach interactions
- Processes user prompts
- Connects financial data with AI responses

### 📊 Utils (`/src/utils/asa.ts`)
- Implements **Average Spending Analysis (ASA)**
- Tracks spending patterns
- Generates insights for AI coaching

---

## 🚀 Getting Started

### 🔧 Prerequisites

- Node.js (v16+)
- npm or yarn
- Expo Go / Emulator
- Neon PostgreSQL database
- Groq API key

=======
- Node.js (v16+)
- npm or yarn
- Expo Go / Emulator
- Neon PostgreSQL database
- Groq API key

>>>>>>> temp-fix
### 🖥️ Backend Setup

```bash
cd backend
npm install
```

Create `.env`:
```
DATABASE_URL=your_neon_database_url
GROQ_API_KEY=your_groq_api_key
JWT_SECRET=your_super_secret_key
```

Run:
```bash
npx drizzle-kit push
npm run dev
```

Backend runs at `http://localhost:3000`

### 📱 Frontend Setup

```bash
cd frontend
npm install
```

Update API base URL in `frontend/services/api.ts`:
```javascript
export const BASE_URL = "http://YOUR_LOCAL_IP:3000/api";
```

Start app:
```bash
npx expo start
```

---

## 📂 Project Structure

```
Spendly/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── services/
│   └── constants/
└── backend/
    ├── src/
    │   ├── controllers/
    │   ├── routes/
    │   ├── utils/
    │   └── middleware/
    ├── db/
    └── package.json
```

---

## 🔥 Features

- 📊 Smart Expense Tracking
- 🎯 Budget Limit Warnings
- 🤖 AI Financial Coach (Groq-powered)
- 📈 Spending Pattern Analysis (ASA Engine)
- 📄 PDF Reports & Sharing
- ⚡ Lightning-fast UI with smooth animations

---

## 🌐 Deployment

Deploy the backend using:
- Render
- Railway
- Vercel (Serverless API)

Ensure you:
- Set environment variables
- Use production database URL
- Update frontend BASE_URL

---

## 🛠️ Future Improvements

- Bank API integrations
- Subscription detection
- AI-based saving goals
- Multi-device sync

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

