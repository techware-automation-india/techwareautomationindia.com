# Vercel Environment Variables Setup

## Your Backend is Live! 🎉

**Backend URL**: https://techwareautomationindia-backend.onrender.com

## Step 1: Update Vercel Environment Variables (CRITICAL)

1. Go to: https://vercel.com/dashboard
2. Click on your project: **techwareautomationindia**
3. Go to: **Settings** → **Environment Variables**
4. Add/Update this variable:

```
Variable Name: VITE_API_URL
Value: https://techwareautomationindia-backend.onrender.com
Environments: ✅ Production ✅ Preview ✅ Development
```

5. **Click "Save"**

## Step 2: Redeploy Vercel

After adding the environment variable:

1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **"Redeploy"** button
4. Wait 2-3 minutes for deployment

## Step 3: Seed Production Database

Your backend database is empty. Add users:

1. Go to: https://dashboard.render.com
2. Click your service: **techwareautomationindia-backend**
3. Click **"Shell"** tab
4. Run this command:

```bash
npm run db:seed
```

This creates:
- Admin: admin@techware.com / Admin@123
- Employee: employee@techware.com / Employee@123
- Customer: customer@techware.com / Customer@123

## Step 4: Test Production

After redeployment, visit:
- https://techwareautomationindia.vercel.app/login/admin

Login with:
- Email: admin@techware.com
- Password: Admin@123

✅ **Should work perfectly now!**

---

## Backend API Endpoints (All Working!)

Base URL: https://techwareautomationindia-backend.onrender.com

- Health Check: `/api/health`
- Auth: `/api/auth/login`
- Employees: `/api/employees`
- Roles & Access: `/api/roles-access/employees`
- All other endpoints...

---

## Summary

✅ Backend deployed on Render.com  
✅ Database connected  
✅ CORS configured for all Vercel deployments  
⚠️ Need to set Vercel env var  
⚠️ Need to seed production database  

Follow steps 1-3 above to complete the deployment! 🚀
