# Railway MySQL Setup Guide

## Step 1: Create Railway Account & MySQL Database (2 minutes)

1. Go to: **https://railway.app/**
2. Click **"Start a New Project"**
3. Click **"Deploy MySQL"**
4. Wait 30 seconds for deployment
5. Click on the MySQL service
6. Go to **"Connect"** tab
7. Copy the **"MySQL Connection URL"**

It will look like:
```
mysql://root:password@containers-us-west-xxx.railway.app:6543/railway
```

## Step 2: Update Your Local .env File

Open `backend/.env` and replace DATABASE_URL with the Railway URL:

```env
DATABASE_URL="mysql://root:password@containers-us-west-xxx.railway.app:6543/railway"
JWT_SECRET="change_me_to_a_long_random_string"
PORT=4001
CLIENT_ORIGIN="http://localhost:5173"
EMAIL_USER="ak0462463@gmail.com"
EMAIL_PASS=epbfnrruwzrgiigy
```

## Step 3: Run Migration (30 seconds)

Open terminal in `backend` folder and run:

```bash
cd backend
npx prisma migrate dev --name init_mysql
```

This creates all tables in your Railway MySQL database.

## Step 4: Update Vercel Environment Variables

1. Go to: **https://vercel.com/dashboard**
2. Click your project → **Settings** → **Environment Variables**
3. Add/Update these variables:

```
DATABASE_URL = mysql://root:password@containers-us-west-xxx.railway.app:6543/railway
JWT_SECRET = change_me_to_a_long_random_string
NODE_ENV = production
CLIENT_ORIGIN = https://techwareautomationindia.vercel.app
EMAIL_USER = ak0462463@gmail.com
EMAIL_PASS = epbfnrruwzrgiigy
```

4. Click **"Redeploy"** to restart with new environment variables

## Step 5: Test

Wait 2 minutes for Vercel to redeploy, then test:
- https://techwareautomationindia.vercel.app

✅ Your site should work now!

---

## Alternative: PlanetScale (Also Free)

If Railway doesn't work, use PlanetScale:

1. Go to: **https://planetscale.com/**
2. Create account with GitHub
3. Create database "techware-hrms"
4. Get connection string
5. Follow steps 2-5 above

Both Railway and PlanetScale have free tiers perfect for your HRMS app!
