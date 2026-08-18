# Complete MySQL Migration & Deployment Guide

## 🎯 Goal
Migrate from SQLite to MySQL and deploy to Vercel successfully.

## ⚡ Quick Start (5 Minutes)

### Step 1: Create Free Railway MySQL (2 min)

1. **Open Railway**: https://railway.app/
2. **Click "Start a New Project"**
3. **Click "Deploy MySQL"**
4. **Wait 30 seconds** for deployment ⏱️
5. **Click the MySQL service card**
6. **Click "Connect" tab**
7. **Copy the "MySQL Connection URL"**

Example URL:
```
mysql://root:abcd1234@containers-us-west-123.railway.app:6543/railway
```

### Step 2: Update Local Environment (30 sec)

Open `backend/.env` and update:

```env
DATABASE_URL="mysql://root:abcd1234@containers-us-west-123.railway.app:6543/railway"
JWT_SECRET="change_me_to_a_long_random_string"
PORT=4001
CLIENT_ORIGIN="http://localhost:5173"
EMAIL_USER="ak0462463@gmail.com"
EMAIL_PASS=epbfnrruwzrgiigy
```

⚠️ **Replace with YOUR actual Railway connection URL!**

### Step 3: Create MySQL Tables (1 min)

Open PowerShell in project root:

```powershell
cd backend
npx prisma migrate dev --name init_mysql
```

This creates all tables in Railway MySQL.

### Step 4: Migrate Existing Data (Optional - 1 min)

If you want to keep your existing SQLite data:

```powershell
# First install better-sqlite3
npm install better-sqlite3

# Run migration script
node migrate-sqlite-to-mysql.js
```

### Step 5: Test Locally (30 sec)

```powershell
# Start backend
cd backend
npm run dev

# In another terminal, start frontend
cd frontend
npm run dev
```

Visit: http://localhost:5173

✅ Should work with MySQL now!

### Step 6: Update Vercel Environment (1 min)

1. Go to: https://vercel.com/dashboard
2. Click your project
3. **Settings** → **Environment Variables**
4. Add/Update:

```
DATABASE_URL = mysql://root:abcd1234@containers-us-west-123.railway.app:6543/railway
JWT_SECRET = change_me_to_a_long_random_string  
NODE_ENV = production
CLIENT_ORIGIN = https://techwareautomationindia.vercel.app
EMAIL_USER = ak0462463@gmail.com
EMAIL_PASS = epbfnrruwzrgiigy
```

5. **Click "Redeploy"**

### Step 7: Push to GitHub (30 sec)

```powershell
git add .
git commit -m "chore: migrate to Railway MySQL database"
git push origin test
```

Vercel will auto-deploy!

### Step 8: Test Production (2 min wait)

Wait 2 minutes for deployment, then visit:
- https://techwareautomationindia.vercel.app

✅ **Should work now!**

---

## 🔧 Troubleshooting

### Error: "Can't reach database server"

**Solution**: Check Railway connection URL is correct in `.env`

### Error: "Table doesn't exist"

**Solution**: Run migrations:
```powershell
cd backend
npx prisma migrate dev
```

### Vercel still shows 500 error

**Solutions**:
1. Check Vercel environment variables are set correctly
2. Check Vercel build logs for errors
3. Make sure you clicked "Redeploy" after adding env vars

### Want to see database

**Use Railway Dashboard**:
1. Go to Railway project
2. Click MySQL service
3. Click "Data" tab
4. Browse tables

Or use **MySQL Workbench**:
1. Download: https://dev.mysql.com/downloads/workbench/
2. Connect using Railway connection URL

---

## 📋 Summary of Changes

✅ Prisma schema already uses MySQL  
✅ Backend `.env` updated with Railway URL  
✅ Migration script created  
✅ Vercel configured for MySQL  
✅ All tables will be created automatically  

---

## 🆘 Need Help?

If you encounter any issues:
1. Check Railway MySQL is running (green status)
2. Verify connection URL is correct
3. Make sure Vercel environment variables match Railway URL
4. Check Vercel deployment logs

**Alternative Option**: Use PlanetScale instead of Railway
- Same steps, just get connection URL from PlanetScale
- https://planetscale.com/

---

## ✨ Benefits of MySQL

✅ Works perfectly on Vercel  
✅ Free hosting on Railway/PlanetScale  
✅ Better performance than SQLite  
✅ Automatic backups  
✅ Can handle multiple connections  
✅ Production-ready  

Good luck! 🚀
