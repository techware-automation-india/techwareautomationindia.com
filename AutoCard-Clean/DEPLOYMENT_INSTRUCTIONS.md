# Vercel Deployment Instructions

## ✅ Prerequisites Completed:
- [x] Updated schema.prisma to use PostgreSQL
- [x] Created PostgreSQL migration
- [x] Configured backend for Vercel serverless
- [x] Added vercel.json configuration

## 🔧 Steps to Deploy:

### 1. Create PostgreSQL Database (Choose one):

#### Option A: Vercel Postgres (Recommended - Easiest)
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Storage** → **Create Database** → **Postgres**
4. Copy the `DATABASE_URL` connection string
5. Go to **Settings** → **Environment Variables**
6. Add: `DATABASE_URL` = (paste your connection string)

#### Option B: Neon.tech (Free PostgreSQL)
1. Go to https://neon.tech
2. Create free account
3. Create new project
4. Copy connection string
5. Add to Vercel Environment Variables: `DATABASE_URL`

### 2. Set Environment Variables in Vercel:
Go to your project → Settings → Environment Variables and add:

```
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key_here
CLIENT_ORIGIN=https://your-frontend-domain.vercel.app
EMAIL_USER=ak0462463@gmail.com
EMAIL_PASS=epbfnrruwzrgiigy
PORT=4001
NODE_ENV=production
```

### 3. Deploy:
```bash
# Commit changes
git add .
git commit -m "feat: migrate to PostgreSQL for Vercel deployment"

# Push to trigger Vercel deployment
git push origin test
```

### 4. Run Migrations on Vercel:
After deployment, go to Vercel Dashboard:
1. Your Project → **Settings** → **Functions**
2. Or use Vercel CLI:
```bash
vercel env pull
npx prisma migrate deploy
```

### 5. Seed Database (Optional):
```bash
# Connect to your database and run seed file
node backend/prisma/seed.js
```

## ⚠️ Important Notes:

1. **File Uploads**: 
   - Multer uploads won't persist on Vercel serverless
   - Use cloud storage (AWS S3, Cloudinary, Vercel Blob Storage)

2. **Database**:
   - SQLite is NOT supported on Vercel
   - PostgreSQL is required

3. **CORS**:
   - Update CLIENT_ORIGIN to your Vercel frontend URL
   - Backend is configured to accept all Vercel domains

## 🚀 Verification:
1. Visit: `https://your-backend.vercel.app/api/health`
2. Should return: `{"status":"ok","server":"running"}`

## 📝 Local Development:
To develop locally with PostgreSQL:
```bash
# Install PostgreSQL locally
# Update .env with local DATABASE_URL
# Run migrations
cd backend
npx prisma migrate dev
npx prisma generate
npm run dev
```

## 🆘 Troubleshooting:
- **500 Error**: Check Vercel logs for database connection issues
- **CORS Error**: Add your frontend URL to CLIENT_ORIGIN
- **Migration Failed**: Ensure DATABASE_URL is correct in Vercel env vars
