# Hostinger Deployment Guide

## Backend Deployment (Node.js/Express)

### 1. Hostinger Build Configuration

In Hostinger dashboard settings:

**Framework preset**: Express
**Branch**: test
**Root directory**: AutoCard-Clean/backend
**Node version**: 18.x
**Package manager**: npm
**Entry file**: `src/index.js` ⚠️ (Change from default server.js)

### 2. Environment Variables

Add these in Hostinger → Environment Variables:

```
DATABASE_URL=mysql://username:password@host:port/database?ssl-mode=REQUIRED
JWT_SECRET=your_secure_random_string_here
PORT=3000
NODE_ENV=production
CLIENT_ORIGIN=https://techwareautomationindia.com
FRONTEND_URL=https://techwareautomationindia.com

# Email configuration (if using nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@techwareautomationindia.com
```

### 3. Build Commands

**Install Command**: 
```bash
npm install
```

**Build Command** (if available):
```bash
npm install && npx prisma generate && npx prisma db push
```

**Start Command**:
```bash
npm start
```

### 4. Backend URL

After deployment, your backend will be available at:
- `https://api.techwareautomationindia.co.org` (or similar)

**Copy this URL** - you'll need it for frontend configuration.

---

## Frontend Deployment (Vercel)

### 1. Update Frontend Environment Variables

In Vercel dashboard → Settings → Environment Variables:

Add/Update:
```
VITE_API_URL=https://your-backend-url-from-hostinger.com
```

Example:
```
VITE_API_URL=https://api.techwareautomationindia.co.org
```

### 2. Update .env.production locally

Update `frontend/.env.production`:

```env
# Production environment - Backend on Hostinger
VITE_API_URL="https://your-backend-url-from-hostinger.com"
```

### 3. Redeploy Frontend

After updating the backend URL, trigger a new deployment on Vercel.

---

## Common Issues & Solutions

### Issue 1: CORS Error
**Error**: "Access to fetch... has been blocked by CORS policy"

**Solution**: 
- Verify backend allows your frontend domain in CORS
- Check `backend/src/index.js` allowedOrigins array includes your frontend URL
- Backend now supports: techwareautomationindia.com, techwareautomationindia.co.org

### Issue 2: Wrong Entry File
**Error**: "Cannot find module 'server.js'"

**Solution**: 
- In Hostinger settings, change Entry file from `server.js` to `src/index.js`

### Issue 3: Database Connection Failed
**Error**: "Database connection failed"

**Solution**:
- Verify DATABASE_URL in Hostinger environment variables
- Ensure MySQL database is accessible from Hostinger servers
- Check database credentials are correct

### Issue 4: Prisma Client Not Generated
**Error**: "Cannot find module '@prisma/client'"

**Solution**:
- Add postinstall script runs automatically: `"postinstall": "prisma generate"`
- Or run manually in Hostinger terminal: `npx prisma generate`

---

## Testing Deployment

### 1. Test Backend Health

```bash
curl https://your-backend-url.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "server": "running"
}
```

### 2. Test Frontend Login

1. Open your frontend URL
2. Try logging in with admin credentials
3. Check browser console for any errors

### 3. Check CORS

In browser console, if you see CORS errors:
- Backend logs will show: "❌ CORS blocked origin: https://..."
- Add that origin to allowedOrigins array in backend/src/index.js

---

## Environment URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| Local | http://localhost:5173 | http://localhost:4001 |
| Production | https://techwareautomationindia.com | https://your-backend.hostinger.com |

---

## Deployment Checklist

Backend (Hostinger):
- [ ] Entry file set to `src/index.js`
- [ ] All environment variables added
- [ ] DATABASE_URL configured
- [ ] JWT_SECRET set (secure random string)
- [ ] Build successful
- [ ] Health endpoint responding

Frontend (Vercel):
- [ ] VITE_API_URL environment variable set
- [ ] Points to correct Hostinger backend URL
- [ ] Build successful
- [ ] Login working
- [ ] No CORS errors

---

## Next Steps

1. **Get your backend URL** from Hostinger after deployment
2. **Update frontend .env.production** with that URL
3. **Add environment variable** in Vercel dashboard
4. **Redeploy frontend** on Vercel
5. **Test login** and verify no CORS errors

