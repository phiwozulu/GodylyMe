# 🚀 Quick Deploy Guide - Your GodlyMe App

## ✅ What's Already Done

- ✅ JWT Secret generated: `2f3a567c595d25921cd7c7156becf6f33a4844b0cf8c9ea1d0178e0f8a9b293ef05d276e16773bf1c6fce2410e1ab9e2b065a68a8b000f4211bf0e97755cf245`
- ✅ Local .env file created at: `vessel-app/backend/.env`
- ✅ Database credentials configured (Elestio PostgreSQL & Redis)
- ✅ Email SMTP configured (Hostinger)
- ✅ All environment variables prepared in `VERCEL_ENV_VARIABLES.txt`

## 🎯 Deploy in 3 Steps

### Step 1: Add Environment Variables to Vercel

**Option A: Via Vercel Dashboard (Easier)**

1. Go to: https://vercel.com/dashboard
2. Select your project (or create new one)
3. Go to: **Settings** → **Environment Variables**
4. Open the file: `VERCEL_ENV_VARIABLES.txt` (in this folder)
5. Copy and paste each variable (make sure to check all 3 environments: Production, Preview, Development)

**Option B: Via CLI (Faster if you have many vars)**

```bash
# Install Vercel CLI if you haven't
npm install -g vercel

# Login
vercel login

# Link your project
vercel link

# Add environment variables (run each command and paste the value when prompted)
vercel env add DATABASE_URL production preview development
vercel env add PGSSLMODE production preview development
vercel env add REDIS_URL production preview development
vercel env add JWT_SECRET production preview development
vercel env add SMTP_HOST production preview development
vercel env add SMTP_PORT production preview development
vercel env add SMTP_USER production preview development
vercel env add SMTP_PASS production preview development
vercel env add EMAIL_FROM production preview development
```

### Step 2: Deploy to Vercel

**Option A: Deploy from GitHub (Recommended)**

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Configure Vercel deployment"
   git push origin main
   ```

2. Go to Vercel Dashboard → **Add New** → **Project**
3. Import your GitHub repository
4. Vercel will auto-detect settings from `vercel.json`
5. Click **Deploy**
6. Wait 2-3 minutes ⏰

**Option B: Deploy via CLI**

```bash
# From the root directory (GodylyMe/)
vercel --prod
```

### Step 3: Update APP_BASE_URL

After your first deployment:

1. Copy your Vercel app URL (e.g., `https://godlyme.vercel.app`)
2. Go to Vercel Dashboard → **Settings** → **Environment Variables**
3. Add/Update `APP_BASE_URL` with your actual URL
4. Redeploy (or it will auto-redeploy)

## 🧪 Test Your Deployment

### Test API Health
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-27T..."}
```

### Test Frontend
Visit: `https://your-app.vercel.app`

### Test User Signup
1. Go to your app
2. Click "Sign Up"
3. Create an account
4. Check your email for verification code
5. Verify and login!

## 🔐 Your Credentials Summary

### PostgreSQL (Elestio)
- Host: `postgresql-godlyme-u57058.vm.elestio.app`
- Port: `25432`
- User: `postgres`
- Password: `TRcvMYUvzEs-2-7YR-gb`
- Database: `postgres`

### Redis (Elestio)
- Host: `redis-godlyme-u57058.vm.elestio.app`
- Port: `26379`
- User: `default`
- Password: `YAi-Jr6OdEDXAgG0Vdjp`

### Email (Hostinger)
- SMTP Host: `smtp.hostinger.com`
- Port: `587`
- User: `verification@godlyme.com`
- Password: `BoboandPhiwoRock2025!`

### JWT Secret (NEW - Generated Now)
```
2f3a567c595d25921cd7c7156becf6f33a4844b0cf8c9ea1d0178e0f8a9b293ef05d276e16773bf1c6fce2410e1ab9e2b065a68a8b000f4211bf0e97755cf245
```

## 🛠️ Local Development

Your local backend is ready to run:

```bash
# Terminal 1 - Backend
cd vessel-app/backend
npm run dev

# Terminal 2 - Frontend
cd vessel-app/frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## 📝 Files Created for You

1. `vessel-app/backend/.env` - Local backend environment variables
2. `VERCEL_ENV_VARIABLES.txt` - Copy-paste ready for Vercel
3. This file - Quick deployment guide

## ❓ Need Help?

- **Full deployment guide**: See `VERCEL_SETUP.md`
- **Step-by-step checklist**: See `DEPLOYMENT_CHECKLIST.md`
- **Environment variables**: See `VERCEL_ENV_VARIABLES.txt`

## 🎉 You're Ready!

Your app is configured and ready to deploy. Just follow the 3 steps above and you'll be live in minutes!

---

**Pro Tip**: Save your JWT secret somewhere safe! If you lose it, users will need to log in again when you change it.

**Current JWT Secret**: `2f3a567c595d25921cd7c7156becf6f33a4844b0cf8c9ea1d0178e0f8a9b293ef05d276e16773bf1c6fce2410e1ab9e2b065a68a8b000f4211bf0e97755cf245`
