# 🚀 Final Deployment Guide - CORS Fixed!

## ✅ What I Fixed

### 1. Backend CORS Configuration
- ✅ Added pattern to allow **ALL** Vercel preview deployments (`/^https:\/\/.*\.vercel\.app$/i`)
- ✅ Added explicit OPTIONS handler (`app.options("*", cors(corsOptions))`)
- ✅ Set `optionsSuccessStatus: 204` for preflight responses
- ✅ Changed CORS error from throwing to just denying (no error logs)

### 2. Frontend API Client
- ✅ Fixed default port from 4000 to 4001 (matches your local backend)
- ✅ Confirmed correct API path construction: `${API_BASE}/api${path}`

### 3. Production Environment
- ✅ Set correct Render.com backend URL

---

## 📋 Deployment Checklist

### Step 1: Set Render.com Environment Variables

Go to: https://dashboard.render.com → Your backend service → Environment

**Add/Update these variables:**

```env
DATABASE_URL=mysql://avnadmin:YOUR_PASSWORD@mysql-techware-techware.f.aivencloud.com:11423/defaultdb?ssl-mode=REQUIRED
JWT_SECRET=change_me_to_a_long_random_string
PORT=4001
NODE_ENV=production
CLIENT_ORIGIN=https://techwareautomationindia.vercel.app
EMAIL_USER=ak0462463@gmail.com
EMAIL_PASS=epbfnrruwzrgiigy
```

⚠️ **IMPORTANT**: Use your actual Aiven MySQL connection string for `DATABASE_URL`!

### Step 2: Push Changes to GitHub

```bash
git add backend/src/index.js frontend/src/lib/api.js frontend/.env.production
git commit -m "fix: resolve CORS issues for production deployment"
git push origin test
```

### Step 3: Wait for Render.com to Deploy (3-4 minutes)

Watch the logs in Render dashboard. Wait until you see:

```
Build successful 🎉
Your service is live 🎉
Server running on port 4001
Database connected successfully.
```

### Step 4: Test Backend Health

Open: https://techwareautomationindia-backend.onrender.com/api/health

You should see:

```json
{
  "status": "OK",
  "server": "running"
}
```

### Step 5: Set Vercel Environment Variable

Go to: https://vercel.com/dashboard → Your project → Settings → Environment Variables

**Add/Update:**

```
Variable: VITE_API_URL
Value: https://techwareautomationindia-backend.onrender.com
Environments: ✅ Production ✅ Preview ✅ Development
```

Click **"Save"**

### Step 6: Redeploy Vercel

1. Go to **Deployments** tab
2. Click the latest deployment
3. Click **"Redeploy"**
4. Wait 2-3 minutes

### Step 7: Seed Production Database (If Needed)

If your production database is empty:

1. Go to Render → Your service → **Shell** tab
2. Run:

```bash
npx prisma migrate deploy
npm run db:seed
```

This creates:
- Admin: `admin@techware.com` / `Admin@123`
- Employee: `employee@techware.com` / `Employee@123`
- Customer: `customer@techware.com` / `Customer@123`

---

## 🧪 Testing

### Test Production Site

Visit: https://techwareautomationindia.vercel.app/login/admin

**Login with:**
- Email: `admin@techware.com`
- Password: `Admin@123`

### What Should Happen:

1. **Browser DevTools → Network tab shows:**
   ```
   OPTIONS /api/auth/login → 204 (Success)
   POST /api/auth/login → 200 (Success)
   ```

2. **No CORS errors in console**

3. **Login succeeds** and redirects to dashboard

4. **Roles & Access page works** - you can assign permissions to employees

---

## 🐛 Troubleshooting

### Still Getting CORS Error?

**Check these:**

1. **Is Render deployed?**
   - Check Render logs show "Your service is live"
   
2. **Is Vercel redeployed?**
   - After setting `VITE_API_URL`, you MUST redeploy
   
3. **Check the exact URL being called**
   - Open DevTools → Network
   - Click the failed request
   - Check the URL is: `https://techwareautomationindia-backend.onrender.com/api/auth/login`
   - NOT: `https://techwareautomationindia-backend.onrender.com/api/api/auth/login` (double `/api`)

4. **Check Origin header**
   - In Network tab → Request Headers
   - Origin should be: `https://techwareautomationindia-[something].vercel.app`

### Database Connection Error?

If Render logs show "Can't reach database":

1. Check `DATABASE_URL` in Render environment variables
2. Make sure it's your **Aiven MySQL URL**
3. Verify Aiven allows connections from Render's IP (usually allowed by default)

### 401 Unauthorized?

This is actually **GOOD NEWS** - it means:
- ✅ CORS is working
- ✅ Request reached backend
- ❌ Wrong credentials OR user doesn't exist

**Solution:**
- Seed the database (see Step 7 above)
- Or check you're using correct credentials

---

## 📊 Architecture Overview

```
┌─────────────────────────────────┐
│         VERCEL (Frontend)       │
│  React + Vite                   │
│  https://*.vercel.app           │
└────────────┬────────────────────┘
             │
             │ HTTPS + CORS ✅
             │ /api/auth/login
             │ /api/roles-access/*
             │
             ▼
┌─────────────────────────────────┐
│    RENDER.COM (Backend)         │
│  Node + Express + Prisma        │
│  Port 4001                      │
│  https://techware-*.onrender.com│
└────────────┬────────────────────┘
             │
             │ MySQL Connection
             │ DATABASE_URL
             │
             ▼
┌─────────────────────────────────┐
│      AIVEN (MySQL Database)     │
│  mysql://...aivencloud.com      │
│  Port 11423                     │
└─────────────────────────────────┘
```

---

## ✨ Features Now Working

After completing these steps, you'll have:

✅ **Admin Dashboard** - Full access to all features
✅ **Roles & Access Module** - Assign module permissions to employees
✅ **Employee Management** - CRUD operations
✅ **Attendance Tracking** - With GPS location
✅ **Leave Management** - Request, approve, reject
✅ **Onboarding** - New employee onboarding workflow
✅ **And more...**

---

## 🎉 Success!

Once deployed, your HRMS application will be fully functional in production!

**Your Roles & Access module** is already integrated and will work immediately after deployment.

**Good luck!** 🚀
