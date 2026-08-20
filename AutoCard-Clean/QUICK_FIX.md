# 🚨 URGENT FIX - Vercel Backend Crash

## ❌ Current Problem:
Vercel is trying to deploy your backend as a serverless function, but it's crashing because:
1. Backend needs persistent server (not serverless)
2. SQLite doesn't work on Vercel serverless
3. File uploads (Multer) won't persist

## ✅ IMMEDIATE SOLUTION:

Your backend should **NOT** be on Vercel at all!

### What I've Done:
1. ✅ Created `.vercelignore` to exclude backend from Vercel
2. ✅ Created `vercel.json` to deploy ONLY frontend
3. ✅ Backend is ready for Render.com deployment

### What YOU Need to Do NOW:

## 🚀 Step 1: Deploy Backend to Render.com (FREE - 5 minutes)
1. **Go to**: https://render.com
2. **Sign up** with GitHub
3. **New +** → **Web Service**
4. **Select**: `techwareautomationindia.com` repository
5. **Configure**:
   ```
   Name: techware-backend
   Branch: test  
   Root Directory: backend
   Build Command: npm install && npx prisma generate && npx prisma migrate deploy
   Start Command: npm start
   ```

6. **Add Environment Variables** (copy from backend/.env):
   ```
   
   JWT_SECRET=change_me_to_a_long_random_string
   PORT=4001
   EMAIL_USER=ak0462463@gmail.com
   EMAIL_PASS=epbfnrruwzrgiigy
   NODE_ENV=production
   ```

7. **Important**: Add this one more variable:
   ```
   CLIENT_ORIGIN=https://techwareautomationindia-rv9jtb0mk-techware-automation-india.vercel.app
   ```

8. **Create Web Service** → Wait 2-3 minutes for deployment

### Step 2: Get Your Backend URL
After deployment, Render will give you a URL like:
```
https://techware-backend-xxxx.onrender.com
```

### Step 3: Update Vercel Environment Variable
1. Go to: https://vercel.com/techware-automation-india/techwareautomationindia-rv9jtb0mk
2. **Settings** → **Environment Variables**
3. **Add New**:
   ```
   Name: VITE_API_URL
   Value: https://techware-backend-xxxx.onrender.com
   ```
4. **Save**

### Step 4: Redeploy Frontend
1. Go to **Deployments** tab
2. Click **⋯** on latest deployment
3. Click **Redeploy**

## ✅ Done! Your app will work in 2-3 minutes!

---

## 🔧 Alternative: Temporary Testing Backend URL

If you can't deploy backend right now, you can temporarily test with:

1. Use **ngrok** to expose your local backend:
   ```bash
   # Install ngrok from ngrok.com
   ngrok http 4001
   ```

2. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

3. Update Vercel env var `VITE_API_URL` to ngrok URL

4. Redeploy frontend

**Note**: ngrok URL changes every time you restart it.

---

## 📝 For Local Development:

Your `.env` file uses localhost, which is correct for local development.
The `.env.production` file will be used when deploying to Vercel.
