# 🔍 Diagnosing Your 500 Error

## What's Happening

Your frontend is successfully reaching the backend (no more CORS! ✅), but the backend is **crashing** when trying to process the login.

## Step 1: Check Render.com Logs (MOST IMPORTANT)

1. Go to: https://dashboard.render.com
2. Click your backend service
3. Click **"Logs"** tab
4. Look for the **latest logs** when you tried to login

**Look for these error patterns:**

### A) Database Connection Error:
```
PrismaClientInitializationError
Can't reach database server at...
```

**Solution**: Your `DATABASE_URL` in Render environment variables is wrong or Aiven blocked Render's IP.

### B) Missing JWT_SECRET:
```
Error: secretOrPrivateKey must have a value
```

**Solution**: Add `JWT_SECRET` to Render environment variables.

### C) User Not Found:
```
Invalid credentials
or
User not found
```

**Solution**: Your production database is empty. Seed it.

---

## Step 2: Verify Render.com Environment Variables

Go to: Render Dashboard → Your Service → **Environment** tab

**Make sure these are ALL set:**

```
DATABASE_URL = mysql://avnadmin:YOUR_PASSWORD@mysql-techware.aivencloud.com:11423/defaultdb?ssl-mode=REQUIRED
JWT_SECRET = change_me_to_a_long_random_string
JWT_EXPIRES_IN = 7d
PORT = 4001
NODE_ENV = production
CLIENT_ORIGIN = https://techwareautomationindia-aq9s4evli-techware-automation-india.vercel.app
EMAIL_USER = ak0462463@gmail.com
EMAIL_PASS = epbfnrruwzrgiigy
```

⚠️ **CRITICAL**: Replace `YOUR_PASSWORD` with your actual Aiven MySQL password!

---

## Step 3: Test Backend Health Endpoint

Open this URL in your browser:

```
https://techwareautomationindia-backend.onrender.com/api/health
```

**Expected response:**
```json
{
  "status": "OK",
  "server": "running"
}
```

**If you see an error or blank page**, your backend isn't even starting. Check Render logs!

---

## Step 4: Check Aiven MySQL Connection

### Option A: From Render Shell

1. Go to Render → Your service → **Shell** tab
2. Run:

```bash
node -e "console.log(process.env.DATABASE_URL)"
```

This shows if `DATABASE_URL` is set.

3. Then test database connection:

```bash
npx prisma db push
```

**Expected**: "Database is in sync"

**If error**: Database URL is wrong or Aiven blocked Render.

### Option B: Check Aiven IP Whitelist

1. Go to your Aiven dashboard
2. Check if Aiven allows connections from **all IPs** or only specific ones
3. Render.com uses dynamic IPs - you need to allow **all IPs** (0.0.0.0/0) for MySQL connections

---

## Step 5: Seed Production Database (If Empty)

If your database has no users:

1. Render → Shell tab
2. Run:

```bash
npm run db:seed
```

This creates:
- admin@techware.com / Admin@123
- employee@techware.com / Employee@123
- customer@techware.com / Customer@123

---

## Quick Fix Commands (Run in Render Shell)

If you just want to get it working ASAP:

```bash
# 1. Check environment variables are set
echo $DATABASE_URL
echo $JWT_SECRET

# 2. Migrate database (create tables)
npx prisma migrate deploy

# 3. Seed database (create users)
npm run db:seed

# 4. Test query
npx prisma studio --browser none
```

---

## Common Causes & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Can't reach database" | Wrong DATABASE_URL | Fix URL in Render env vars |
| "secretOrPrivateKey" | Missing JWT_SECRET | Add to Render env vars |
| "Invalid credentials" | Database empty | Run `npm run db:seed` |
| "ECONNREFUSED" | Aiven blocked Render IP | Allow all IPs in Aiven |
| 500 but no logs | Out of memory | Upgrade Render instance |

---

## What to Send Me

If still not working, send me:

1. **Screenshot of Render logs** (from when you tried to login)
2. **Screenshot of Render environment variables** (blur passwords)
3. **Result of**: `https://techwareautomationindia-backend.onrender.com/api/health`

Then I can tell you exactly what's wrong!

---

## Expected Flow (When Working)

```
User clicks "Sign In"
    ↓
POST https://techwareautomationindia-backend.onrender.com/api/auth/login
    ↓
Render backend receives request
    ↓
Prisma connects to Aiven MySQL
    ↓
Query: SELECT * FROM users WHERE email = ?
    ↓
Check password hash with bcrypt
    ↓
Generate JWT token
    ↓
Return: { token, user, role }
    ↓
Frontend stores token
    ↓
Redirect to dashboard
```

**Your flow is breaking somewhere** - the logs will tell us where!

---

## Most Likely Issue

Based on your earlier setup, I think:

**Your Render.com doesn't have the correct Aiven MySQL connection string in DATABASE_URL**

The connection string should look like:
```
mysql://avnadmin:AVNS_...@mysql-techware-techware.f.aivencloud.com:11423/defaultdb?ssl-mode=REQUIRED
```

Check Render environment variables NOW!
