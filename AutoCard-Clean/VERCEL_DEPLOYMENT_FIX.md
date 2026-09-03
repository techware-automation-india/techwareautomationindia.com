# Vercel Deployment Fix Guide

## Problem
Your Vercel frontend is showing CORS errors because:
1. Frontend is trying to call API at the same domain (Vercel)
2. Backend environment variable `VITE_API_URL` is not set on Vercel
3. Frontend defaults to `localhost:4001` which doesn't exist on Vercel

## Solution: Set Environment Variables on Vercel

### Step 1: Login to Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select your project: `techwareautomationindia`

### Step 2: Add Environment Variables

**Go to**: Project Settings → Environment Variables

Add the following variable:

**Variable Name:** `VITE_API_URL`
**Value:** `https://techwareautomationindia-backend.onrender.com`
**Environment:** Production, Preview, Development (select all)

Click **Save**

### Step 3: Redeploy

After adding the environment variable:

**Option A: Redeploy from Vercel Dashboard**
1. Go to Deployments tab
2. Click the three dots (...) on the latest deployment
3. Click "Redeploy"

**Option B: Push a commit to trigger deployment**
```bash
git commit --allow-empty -m "Trigger Vercel redeploy"
git push origin test
```

### Step 4: Verify

After redeployment:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to login
4. Check Network tab - API calls should go to:
   `https://techwareautomationindia-backend.onrender.com/api/auth/login`
   NOT the Vercel domain

---

## Alternative: Deploy Backend to Vercel

If you want both frontend and backend on Vercel:

### Backend Deployment:

1. **Create new Vercel project for backend**:
   - Import from GitHub: `backend` folder
   - Framework: Other
   - Build Command: `npm install`
   - Output Directory: `./`

2. **Set Environment Variables**:
   ```
   DATABASE_URL=mysql://user:pass@host:3306/db?connection_limit=3
   JWT_SECRET=your-secret-key
   NODE_ENV=production
   PORT=4000
   ```

3. **Create `vercel.json` in backend folder**:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "src/index.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "src/index.js"
       }
     ]
   }
   ```

4. **Update frontend VITE_API_URL** to new backend URL

---

## Current Architecture

### Production URLs:
- **Frontend**: https://techwareautomation.in (Hostinger)
- **Frontend Preview**: https://techwareautomationindia.hzghqeq4-techware-automation-india.vercel.app
- **Backend**: https://techwareautomationindia-backend.onrender.com (Render.com)

### Required Environment Variables:

**Frontend** (Vercel):
```bash
VITE_API_URL=https://techwareautomationindia-backend.onrender.com
```

**Backend** (Render.com):
```bash
DATABASE_URL=mysql://user:pass@host:3306/database
JWT_SECRET=your-jwt-secret
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://techwareautomation.in
FRONTEND_URL=https://techwareautomation.in
```

---

## Quick Fix: Update Vercel Environment Variable NOW

1. **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. **Add**:
   - Name: `VITE_API_URL`
   - Value: `https://techwareautomationindia-backend.onrender.com`
   - Environments: ✓ Production ✓ Preview ✓ Development

3. **Redeploy**

That's it! Your login should work after redeployment. ✅
