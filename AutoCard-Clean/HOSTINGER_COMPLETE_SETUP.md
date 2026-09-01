# Complete Hostinger Deployment Setup

## Part 1: MySQL Database Setup

### 1.1 Create Database in Hostinger

1. Login to Hostinger → **Databases** → **MySQL Databases**
2. Click **"Create Database"**
3. Fill in:
   - Database name: `techware_autocard`
   - Username: (auto-generated or create new)
   - Password: (strong password)
4. Click **Create**

### 1.2 Note Your Database Credentials

After creation, note these details:
```
Database Name: techware_autocard
Username: your_username
Password: your_password
Host: localhost (or 127.0.0.1)
Port: 3306
```

### 1.3 Create DATABASE_URL

Format:
```
DATABASE_URL="mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME"
```

Example:
```
DATABASE_URL="mysql://techware_user:SecurePass123@localhost:3306/techware_autocard"
```

---

## Part 2: Backend Deployment

### 2.1 Create New Website/Application

1. Go to Hostinger → **Websites** → **Add Website**
2. Choose **Node.js Application**
3. Settings:
   - **Application name**: techware-backend
   - **Domain/Subdomain**: Create subdomain like `api.techwareautomation.in`

### 2.2 Configure Node.js Application

**Framework preset**: Express
**Branch**: test
**Root directory**: `AutoCard-Clean/backend`
**Node version**: 18.x or 20.x
**Package manager**: npm
**Entry file**: `src/index.js` ⚠️ (NOT server.js)

### 2.3 Add Environment Variables

In Hostinger → Your Backend App → **Environment Variables**:

```env
DATABASE_URL=mysql://your_username:your_password@localhost:3306/techware_autocard
JWT_SECRET=your_very_long_random_secret_string_here_min_32_chars
PORT=3000
NODE_ENV=production
CLIENT_ORIGIN=https://techwareautomation.in
FRONTEND_URL=https://techwareautomation.in

# Email Configuration (optional - for notifications)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
EMAIL_FROM=noreply@techwareautomation.in
```

**Important Notes**:
- Replace `your_username`, `your_password` with actual database credentials
- Generate a secure JWT_SECRET (32+ characters random string)
- Use the database you created in Step 1

### 2.4 Build Commands

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

### 2.5 Deploy

1. Click **"Deploy"** or **"Save and Deploy"**
2. Wait for build to complete
3. Check deployment logs for errors

### 2.6 Note Backend URL

After successful deployment, your backend will be at:
```
https://api.techwareautomation.in
```

(or whatever subdomain you configured)

**Save this URL** - you'll need it for frontend configuration!

---

## Part 3: Initialize Database

### 3.1 Run Database Migration

After backend deploys successfully, you need to initialize the database.

**Option A: Automatic (via Prisma)**
The build command already includes `npx prisma db push` which creates tables.

**Option B: Manual (if needed)**
1. Access Hostinger's file manager or SSH
2. Navigate to backend directory
3. Run:
```bash
npx prisma db push
npx prisma db seed
```

### 3.2 Verify Database

Check that tables were created:
1. Go to Hostinger → **Databases** → **phpMyAdmin**
2. Select your database
3. Verify tables exist: User, Employee, Customer, Attendance, etc.

---

## Part 4: Update Frontend Configuration

### 4.1 Update Frontend Environment Variable

Now that you have the backend URL, update the frontend:

**In Hostinger** → Your Frontend App → **Environment Variables**:

Add or update:
```
VITE_API_URL=https://api.techwareautomation.in
```

(Replace with your actual backend URL)

### 4.2 Redeploy Frontend

1. Click **"Redeploy"** or trigger new deployment
2. Wait for build to complete

---

## Part 5: Test the Application

### 5.1 Test Backend Health

Open in browser:
```
https://api.techwareautomation.in/api/health
```

Expected response:
```json
{
  "status": "OK",
  "server": "running"
}
```

### 5.2 Test Frontend Login

1. Go to: `https://techwareautomation.in/login`
2. Try logging in with admin credentials
3. Check browser console for errors

### 5.3 Verify CORS

If you see CORS errors:
- Backend logs will show: "❌ CORS blocked origin: https://..."
- The CORS fix we pushed should handle this
- If still blocked, check backend environment variables

---

## Common Issues & Solutions

### Issue 1: "Cannot find module 'src/index.js'"

**Solution**: 
- Entry file must be `src/index.js` (not `server.js`)
- Check Hostinger build configuration

### Issue 2: "Database connection failed"

**Solution**:
- Verify DATABASE_URL format is correct
- Check database credentials
- Ensure database exists
- Check host (use `localhost` or `127.0.0.1`)

### Issue 3: "CORS policy blocked"

**Solution**:
- Verify CLIENT_ORIGIN and FRONTEND_URL environment variables
- Should match your frontend domain exactly
- Backend code already includes CORS fix

### Issue 4: "Prisma Client not generated"

**Solution**:
- Add to build command: `npx prisma generate`
- Or it runs automatically via postinstall script

### Issue 5: "Tables not created"

**Solution**:
- Run: `npx prisma db push`
- This creates tables from schema
- Check database in phpMyAdmin

---

## Security Checklist

- [ ] Strong database password used
- [ ] JWT_SECRET is random and 32+ characters
- [ ] Environment variables set (not hardcoded)
- [ ] Database host is localhost (internal only)
- [ ] NODE_ENV set to "production"
- [ ] .env files NOT committed to git

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│   Frontend (Hostinger)              │
│   https://techwareautomation.in     │
│   - React + Vite                    │
│   - Connects to backend via API     │
└──────────────┬──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│   Backend (Hostinger)               │
│   https://api.techwareautomation.in │
│   - Express + Prisma                │
│   - Handles authentication          │
│   - Business logic                  │
└──────────────┬──────────────────────┘
               │ MySQL
               ▼
┌─────────────────────────────────────┐
│   Database (Hostinger)              │
│   localhost:3306                    │
│   - MySQL                           │
│   - All application data            │
└─────────────────────────────────────┘
```

---

## What You Need From Hostinger

To complete this setup, you need:

1. **MySQL Database Details**:
   - Database name
   - Username
   - Password
   - Host & Port

2. **Backend URL** (after deployment):
   - The full URL where backend is accessible
   - Example: `https://api.techwareautomation.in`

3. **File Access** (for database seeding):
   - SSH access OR File Manager
   - To run `npx prisma db seed`

---

## Next Steps

1. ✅ Create MySQL database in Hostinger
2. ✅ Note database credentials
3. ✅ Deploy backend with environment variables
4. ✅ Get backend URL
5. ✅ Update frontend with backend URL
6. ✅ Test login functionality

Once you have the database credentials and backend URL, share them with me and I'll update the configuration files and push to the test branch!

