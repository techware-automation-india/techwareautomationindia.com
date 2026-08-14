# Deployment Instructions (SQLite with Render.com)

## 🎯 Architecture:
- **Frontend**: Vercel (Already deployed)
- **Backend**: Render.com (FREE - Supports SQLite)

---

## 🚀 Deploy Backend to Render.com (FREE)

### Step 1: Sign Up & Create Web Service
1. Go to https://render.com
2. Sign up with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository

### Step 2: Configure Web Service
Fill in these settings:

```
Name: techware-backend
Region: Singapore (closest to India)
Branch: test
Root Directory: backend
Runtime: Node
Build Command: npm install && npx prisma generate && npx prisma migrate deploy
Start Command: npm start
```

### Step 3: Add Environment Variables
In Render dashboard, add these:

```
DATABASE_URL=file:./prisma/dev.db
JWT_SECRET=change_me_to_a_long_random_string
PORT=4001
CLIENT_ORIGIN=https://your-frontend-url.vercel.app
EMAIL_USER=ak0462463@gmail.com
EMAIL_PASS=epbfnrruwzrgiigy
NODE_ENV=production
```

### Step 4: Deploy!
- Click **"Create Web Service"**
- Render will automatically deploy
- Wait 2-3 minutes
- Your backend URL: `https://techware-backend.onrender.com`

### Step 5: Update Frontend
Update your frontend `.env` to point to Render backend:

```env
VITE_API_URL=https://techware-backend.onrender.com/api
```

Then redeploy frontend on Vercel.

---

## ✅ Advantages of Render.com:

1. ✅ **FREE** forever (with 750 hours/month)
2. ✅ **SQLite supported** (persistent disk storage)
3. ✅ **File uploads work** (Multer)
4. ✅ **Auto-deploy** from GitHub
5. ✅ **SSL certificate** included
6. ✅ **No cold starts** on free plan after first deploy

---

## 🔄 Alternative: Railway.app

If Render doesn't work, try Railway.app:

1. https://railway.app
2. "New Project" → GitHub repo
3. Select `backend` folder
4. Add environment variables
5. Deploy

---

## 📝 Local Development (No Changes Needed)

Your local setup remains the same:

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🆘 Troubleshooting:

**Issue**: Backend URL not working
**Fix**: Check Render logs, ensure all env vars are set

**Issue**: CORS error
**Fix**: Update `CLIENT_ORIGIN` in Render env vars to match your Vercel frontend URL

**Issue**: Database not persisting
**Fix**: Render free tier has persistent disk. Enable it in Settings → Disk

---

## 🎉 Final Result:

- Frontend: `https://your-app.vercel.app` (Fast, CDN)
- Backend: `https://techware-backend.onrender.com` (SQLite, persistent)
- Database: SQLite on Render disk (automatically backed up)
