# Vercel Deployment Checklist ✅

Use this checklist to deploy your GodlyMe application to Vercel step by step.

## Prerequisites

- [ ] GitHub/GitLab/Bitbucket account
- [ ] Vercel account ([sign up here](https://vercel.com/signup))
- [ ] Code pushed to a Git repository

## Step 1: Set Up Databases

### Option A: Vercel Managed Databases (Recommended - Easiest)

- [ ] Go to [Vercel Dashboard](https://vercel.com/dashboard)
- [ ] Create or select your project
- [ ] Go to **Storage** tab
- [ ] Click **Create Database**
  - [ ] Select **Postgres** → Create
  - [ ] Name it (e.g., "godlyme-postgres")
  - [ ] Note: `DATABASE_URL` and `PGSSLMODE` will be automatically added to your project
- [ ] Click **Create Database** again
  - [ ] Select **KV (Redis)** → Create
  - [ ] Name it (e.g., "godlyme-redis")
  - [ ] Note: `REDIS_URL` will be automatically added to your project

### Option B: External Database Providers (More control)

#### PostgreSQL Setup

Choose one:

- [ ] **Neon** (Recommended for serverless)
  - [ ] Sign up at [neon.tech](https://neon.tech)
  - [ ] Create a new project
  - [ ] Copy the connection string from the dashboard
  - [ ] Format: `postgres://user:password@host/database?sslmode=require`

- [ ] **Supabase**
  - [ ] Sign up at [supabase.com](https://supabase.com)
  - [ ] Create a new project
  - [ ] Go to Settings → Database
  - [ ] Copy the "Connection pooling" connection string (use Supavisor mode)

- [ ] **Railway**
  - [ ] Sign up at [railway.app](https://railway.app)
  - [ ] Create a new PostgreSQL database
  - [ ] Copy the connection string from variables

#### Redis Setup

Choose one:

- [ ] **Upstash** (Recommended for serverless)
  - [ ] Sign up at [upstash.com](https://upstash.com)
  - [ ] Create a Redis database
  - [ ] Copy the connection string (format: `redis://...`)

- [ ] **Redis Labs**
  - [ ] Sign up at [redis.com](https://redis.com)
  - [ ] Create a Redis database
  - [ ] Copy the connection string

## Step 2: Generate JWT Secret

- [ ] Run the JWT secret generator:
  ```bash
  node generate-jwt-secret.js
  ```
- [ ] Copy the generated secret (you'll need it in the next step)

## Step 3: Configure Environment Variables

### In Vercel Dashboard:

- [ ] Go to your project → **Settings** → **Environment Variables**
- [ ] Add the following variables (if not auto-added by Vercel databases):

| Variable | Value | Environments |
|----------|-------|--------------|
| `DATABASE_URL` | `postgres://...` | ✅ Production ✅ Preview ✅ Development |
| `REDIS_URL` | `redis://...` | ✅ Production ✅ Preview ✅ Development |
| `JWT_SECRET` | (paste generated secret) | ✅ Production ✅ Preview ✅ Development |
| `PGSSLMODE` | `require` | ✅ Production ✅ Preview ✅ Development |

### Optional Email Variables (for sending verification emails):

- [ ] Add email configuration (or skip to use console logging):

| Variable | Value | Environments |
|----------|-------|--------------|
| `SMTP_HOST` | `smtp.hostinger.com` | ✅ Production ✅ Preview ✅ Development |
| `SMTP_PORT` | `587` | ✅ Production ✅ Preview ✅ Development |
| `SMTP_USER` | `verification@godlyme.com` | ✅ Production ✅ Preview ✅ Development |
| `SMTP_PASS` | (your email password) | ✅ Production ✅ Preview ✅ Development |
| `EMAIL_FROM` | `"Godly Me <verification@godlyme.com>"` | ✅ Production ✅ Preview ✅ Development |

### Via Vercel CLI (Alternative):

- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Add environment variables:
  ```bash
  vercel env add DATABASE_URL production
  vercel env add REDIS_URL production
  vercel env add JWT_SECRET production
  vercel env add PGSSLMODE production
  ```

## Step 4: Deploy to Vercel

### Option A: Deploy from Git (Recommended)

- [ ] Push your code to GitHub/GitLab/Bitbucket
- [ ] Go to [Vercel Dashboard](https://vercel.com/dashboard)
- [ ] Click **Add New...** → **Project**
- [ ] Select your Git repository
- [ ] Configure project:
  - Framework Preset: **Other**
  - Root Directory: `./`
  - Build Command: (leave default, uses vercel.json)
  - Output Directory: (leave default, uses vercel.json)
- [ ] Click **Deploy**
- [ ] Wait for deployment to complete (usually 2-3 minutes)

### Option B: Deploy via CLI

- [ ] From the project root directory:
  ```bash
  vercel --prod
  ```
- [ ] Follow the prompts
- [ ] Wait for deployment to complete

## Step 5: Verify Deployment

- [ ] Test the API health endpoint:
  ```bash
  curl https://your-app.vercel.app/api/health
  ```
  Expected response: `{"status":"ok","timestamp":"..."}`

- [ ] Visit your frontend: `https://your-app.vercel.app`

- [ ] Test user signup flow:
  - [ ] Go to signup page
  - [ ] Register a new user
  - [ ] Check for verification email or console logs

## Step 6: Optional Configuration

### Custom Domain

- [ ] Go to project → **Settings** → **Domains**
- [ ] Add your custom domain
- [ ] Update DNS settings as instructed
- [ ] Wait for SSL certificate to be issued

### Email Configuration (if skipped earlier)

- [ ] Add SMTP environment variables (see Step 3)
- [ ] Redeploy: `vercel --prod` or push to Git

### Database Tables Initialization

The database tables are created automatically on first use, but you can verify:

- [ ] Check your PostgreSQL database for the `users` table
- [ ] If needed, run migrations manually (if you have any)

## Step 7: Monitor and Debug

- [ ] Check deployment logs in Vercel Dashboard
- [ ] Monitor function logs under **Deployments** → select deployment → **Functions**
- [ ] Set up error tracking (optional: Sentry, LogRocket, etc.)

## Troubleshooting

### Issue: Build fails

- [ ] Check build logs in Vercel Dashboard
- [ ] Verify all dependencies are in package.json
- [ ] Test build locally: `cd vessel-app/frontend && npm run build`

### Issue: API returns 500 errors

- [ ] Check function logs in Vercel Dashboard
- [ ] Verify environment variables are set correctly
- [ ] Check database connection strings

### Issue: Database connection errors

- [ ] Verify `DATABASE_URL` is correct
- [ ] Check `PGSSLMODE` is set to `require` for cloud databases
- [ ] Test connection string locally

### Issue: Email not sending

- [ ] Verify SMTP credentials are correct
- [ ] Check SMTP_PORT is correct (usually 587 or 465)
- [ ] If no SMTP configured, check console logs for verification codes

## Success! 🎉

Your app is now live at: `https://your-app.vercel.app`

### Next Steps:

- [ ] Share your app URL
- [ ] Set up monitoring
- [ ] Configure custom domain
- [ ] Set up continuous deployment (already done if using Git)
- [ ] Add more features!

## Quick Reference

| Resource | URL |
|----------|-----|
| Vercel Dashboard | https://vercel.com/dashboard |
| Project Settings | https://vercel.com/[your-team]/[project]/settings |
| Environment Variables | https://vercel.com/[your-team]/[project]/settings/environment-variables |
| Deployment Logs | https://vercel.com/[your-team]/[project]/deployments |
| Domain Settings | https://vercel.com/[your-team]/[project]/settings/domains |

## Support Documents

- [README.md](README.md) - Project overview
- [VERCEL_SETUP.md](VERCEL_SETUP.md) - Detailed deployment guide
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Technical configuration details
- [.env.example](.env.example) - Environment variables template

---

**Need help?** Check the [VERCEL_SETUP.md](VERCEL_SETUP.md) troubleshooting section or Vercel's documentation.
