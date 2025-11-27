# GodlyMe - Social Platform

A modern social platform built with React, Express, PostgreSQL, and Redis.

## 🚀 Quick Start

### Local Development

1. **Install dependencies**
   ```bash
   cd vessel-app
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   cd ../api && npm install
   ```

2. **Set up environment variables**
   ```bash
   cd vessel-app/backend
   cp .env.example .env
   # Edit .env with your local database credentials
   ```

3. **Start the development servers**
   ```bash
   # Terminal 1 - Backend API
   cd vessel-app/backend
   npm run dev

   # Terminal 2 - Frontend
   cd vessel-app/frontend
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:4000

### Deploy to Vercel

📖 **See [VERCEL_SETUP.md](VERCEL_SETUP.md) for complete deployment instructions**

**Quick steps:**

1. **Generate JWT Secret**
   ```bash
   node generate-jwt-secret.js
   ```

2. **Set up databases** (choose one option for each):
   - PostgreSQL: Vercel Postgres, Neon, Supabase, or Railway
   - Redis: Vercel KV, Upstash, or Redis Labs

3. **Configure environment variables** in Vercel Dashboard:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `PGSSLMODE` (set to `require` for production)

4. **Deploy**
   ```bash
   vercel --prod
   ```

## 📁 Project Structure

```
vessel-app/
├── api/              # Vercel serverless functions (production)
├── backend/          # Express server (local development)
├── frontend/         # React application
└── shared/           # Shared types and utilities
```

## 🔧 Technologies

- **Frontend**: React 18, TypeScript, Vite, React Router
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (user data), Redis (caching)
- **Authentication**: JWT tokens
- **Email**: Nodemailer (SMTP)
- **Deployment**: Vercel (serverless functions + static hosting)

## 📚 Documentation

- [VERCEL_SETUP.md](VERCEL_SETUP.md) - Complete Vercel deployment guide
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Overview of deployment setup and fixes
- [.env.example](.env.example) - Environment variables template

## 🔐 Security

- Passwords hashed with bcrypt
- JWT-based authentication
- CORS protection
- Input validation with Zod
- SQL injection prevention with parameterized queries

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Verify email with code
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Health
- `GET /api/health` - API health check

## 🧪 Testing

```bash
# Test API health (after deployment)
curl https://your-app.vercel.app/api/health
```

## 🛠️ Development Scripts

### Backend
```bash
cd vessel-app/backend
npm run dev       # Start development server with hot reload
npm run build     # Build TypeScript to JavaScript
npm start         # Start production server
```

### Frontend
```bash
cd vessel-app/frontend
npm run dev       # Start Vite development server
npm run build     # Build for production
npm run preview   # Preview production build
```

## 📝 Environment Variables

See [.env.example](.env.example) for all available environment variables.

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT signing
- `PGSSLMODE` - PostgreSQL SSL mode

**Optional:**
- Email configuration (SMTP_HOST, SMTP_PORT, etc.)
- `APP_BASE_URL` - Frontend URL
- `UPLOAD_MAX_BYTES` - Max upload size

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For deployment issues, check:
- [VERCEL_SETUP.md](VERCEL_SETUP.md) - Deployment guide
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Configuration reference
- Vercel Dashboard logs
- Function logs in Vercel

## 🎯 Next Steps

1. ✅ Local development setup
2. ⏭️ Set up production databases
3. ⏭️ Configure Vercel environment variables
4. ⏭️ Deploy to Vercel
5. ⏭️ Set up custom domain (optional)
6. ⏭️ Configure email SMTP (optional)
