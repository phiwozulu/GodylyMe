# Vercel Deployment Setup Guide

This guide explains how to deploy your GodlyMe application to Vercel and configure the necessary environment variables.

## Project Structure

```
GodylyMe/
├── vessel-app/
│   ├── api/              # Serverless API functions for Vercel
│   ├── backend/          # Local development backend (Express)
│   ├── frontend/         # React frontend application
│   └── package.json
├── vercel.json           # Vercel configuration
└── .vercelignore        # Files to ignore during deployment
```

## Deployment Steps

### 1. Install Vercel CLI (Optional for local testing)

```bash
npm install -g vercel
```

### 2. Link Your Project to Vercel

From the root directory (`GodylyMe/`):

```bash
vercel
```

Follow the prompts to:
- Log in to your Vercel account
- Link to an existing project or create a new one
- Confirm the project settings

### 3. Configure Environment Variables in Vercel Dashboard

Go to your project in the Vercel dashboard: **Settings → Environment Variables**

Add the following environment variables for **Production**, **Preview**, and **Development**:

#### Required Environment Variables

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://username:password@host:5432/database?sslmode=require` |
| `REDIS_URL` | Redis connection string | `redis://default:password@host:6379/0` |
| `JWT_SECRET` | Secret key for JWT token signing | `your-secure-random-hex-string-here` |
| `PGSSLMODE` | PostgreSQL SSL mode | `require` (for production) or `disable` (for local) |

#### Email Configuration (Optional)

If you want to send real verification emails, configure these variables. Otherwise, leave them blank and preview links will be logged to the console.

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| `SMTP_HOST` | SMTP server hostname | `smtp.hostinger.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username/email | `verification@godlyme.com` |
| `SMTP_PASS` | SMTP password | `your-email-password` |
| `EMAIL_FROM` | From address for emails | `"Godly Me Verification <verification@godlyme.com>"` |

#### Optional Configuration

| Variable Name | Description | Example Value | Default |
|--------------|-------------|---------------|---------|
| `APP_BASE_URL` | Frontend URL for email links | `https://godlyme.vercel.app` | Auto-detected |
| `UPLOAD_MAX_BYTES` | Max upload size in bytes | `209715200` | 200MB |
| `PORT` | Server port (local dev only) | `4000` | 4000 |

### 4. Setting Environment Variables via CLI (Alternative)

You can also set environment variables using the Vercel CLI:

```bash
# Production
vercel env add DATABASE_URL production
vercel env add REDIS_URL production
vercel env add JWT_SECRET production
vercel env add PGSSLMODE production

# Preview (optional, for PR previews)
vercel env add DATABASE_URL preview
vercel env add REDIS_URL preview
vercel env add JWT_SECRET preview
vercel env add PGSSLMODE preview

# Development (optional, for local development with vercel dev)
vercel env add DATABASE_URL development
vercel env add REDIS_URL development
vercel env add JWT_SECRET development
vercel env add PGSSLMODE development
```

After running each command, paste the actual value when prompted.

### 5. Deploy to Vercel

#### Deploy from Git (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Import your repository in Vercel dashboard
3. Vercel will automatically deploy on every push to main/master

#### Manual Deploy via CLI

From the root directory:

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

## Database Setup

### PostgreSQL Database Options

You need a PostgreSQL database. Here are some options:

1. **Vercel Postgres** (Recommended for simplicity)
   - Go to Vercel Dashboard → Storage → Create Database → Postgres
   - Automatically adds `DATABASE_URL` to your environment variables

2. **Neon** (Free tier available)
   - Sign up at [neon.tech](https://neon.tech)
   - Create a database and copy the connection string
   - Format: `postgres://user:password@host/database?sslmode=require`

3. **Supabase** (Free tier available)
   - Sign up at [supabase.com](https://supabase.com)
   - Create a project and get the connection string from Settings → Database
   - Use the "Connection String" under "Connection pooling"

4. **Railway** (Free tier available)
   - Sign up at [railway.app](https://railway.app)
   - Create a PostgreSQL database
   - Copy the connection string from the database settings

### Redis Database Options

You need a Redis database. Here are some options:

1. **Vercel KV** (Recommended for simplicity)
   - Go to Vercel Dashboard → Storage → Create Database → KV
   - Automatically adds `REDIS_URL` to your environment variables

2. **Upstash** (Free tier available)
   - Sign up at [upstash.com](https://upstash.com)
   - Create a Redis database
   - Copy the connection string (use the "redis://" format)

3. **Redis Labs** (Free tier available)
   - Sign up at [redis.com](https://redis.com)
   - Create a database
   - Copy the connection string

## Generating JWT Secret

Generate a secure random string for `JWT_SECRET`:

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 64

# Option 3: Using online generator
# Visit: https://www.uuidgenerator.net/
```

## Vercel Configuration Explained

The `vercel.json` file in the root directory configures:

- **buildCommand**: Builds the frontend React app
- **outputDirectory**: Where the built frontend files are located
- **installCommand**: Installs dependencies for all workspaces
- **functions**: Configuration for serverless API functions
  - `maxDuration`: Maximum execution time (10 seconds)
- **rewrites**: Routes API calls to serverless functions and serves the frontend

## Testing Your Deployment

### 1. Test the Health Endpoint

After deployment, test your API:

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-27T..."
}
```

### 2. Test Frontend

Visit `https://your-app.vercel.app` in your browser to see the frontend.

## Local Development with Vercel

To test your app locally with Vercel's environment:

```bash
# Pull environment variables from Vercel
vercel env pull

# Start local development server
vercel dev
```

This will:
- Load environment variables from Vercel
- Start the frontend on port 3000
- Start serverless functions locally

## Troubleshooting

### Issue: "DATABASE_URL is not defined"

**Solution**: Ensure `DATABASE_URL` is set in Vercel environment variables for the correct environment (Production/Preview/Development).

### Issue: "REDIS_URL is not configured"

**Solution**: Ensure `REDIS_URL` is set in Vercel environment variables.

### Issue: "JWT_SECRET is not configured"

**Solution**: Generate a secure random string and add it as `JWT_SECRET` in Vercel environment variables.

### Issue: API routes return 404

**Solution**:
- Check that your API files are in `vessel-app/api/` directory
- Verify the `rewrites` section in `vercel.json`
- Ensure files export a default function handler

### Issue: Database SSL errors

**Solution**:
- For production databases, set `PGSSLMODE=require`
- For local development without SSL, set `PGSSLMODE=disable`
- Some providers require specific SSL settings in the connection string

### Issue: Build fails

**Solution**:
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript has no errors: `cd vessel-app/frontend && npm run build`

## Environment Variables Quick Reference

Copy this template and fill in your values:

```bash
# Database
DATABASE_URL=postgres://user:password@host:5432/database?sslmode=require
PGSSLMODE=require

# Redis
REDIS_URL=redis://default:password@host:6379/0

# Authentication
JWT_SECRET=your-64-character-random-hex-string

# Email (Optional - leave blank to use console logging)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=verification@godlyme.com
SMTP_PASS=your-email-password
EMAIL_FROM="Godly Me Verification <verification@godlyme.com>"

# Optional
APP_BASE_URL=https://your-app.vercel.app
UPLOAD_MAX_BYTES=209715200
```

## Next Steps

1. Set up your PostgreSQL database (Vercel Postgres, Neon, Supabase, etc.)
2. Set up your Redis database (Vercel KV, Upstash, etc.)
3. Generate a JWT secret
4. Add all environment variables to Vercel
5. Deploy your application
6. Test the API and frontend

## Support

If you encounter issues:
- Check Vercel deployment logs
- Review the Vercel documentation: https://vercel.com/docs
- Check the function logs in Vercel dashboard under "Deployments" → "Functions"
