# 🕒 Render 24/7 Keep-Alive Setup Guide (Solution 1)

Render Free Tier puts backend web services to sleep if no HTTP request is received within 15 minutes. This creates a 50+ second "cold start" delay when employees or admins access the dashboard.

Setting up a free external ping service ensures an HTTP request hits your Render backend every **10 minutes**, keeping it **alive 24/7 forever** with zero cold starts.

---

## 🔗 Your Backend Health URL

Copy this exact URL:
```text
https://techwareautomationindia-backend.onrender.com/api/health
```

*(If your Render service name is slightly different, replace `techwareautomationindia-backend` with your exact Render subdomain).*

---

## 🛠️ Step-by-Step Setup: cron-job.org (Free Forever)

### Step 1: Create a Free Account
1. Open [https://cron-job.org](https://cron-job.org) in your browser.
2. Click **Sign Up** (it takes 30 seconds and is completely free).

### Step 2: Create the Cron Job
1. In the dashboard, click the blue **"Create Cronjob"** button.
2. Fill in the fields:
   - **Title**: `Techware Render Keep-Alive`
   - **URL**: `https://techwareautomationindia-backend.onrender.com/api/health`
   - **Execution schedule**: Select **"User-defined"**
     - Set interval to: **Every 10 minutes** (e.g. `*/10 * * * *`)
   - **Request Method**: `GET`
3. Click **"Save"**.

---

## 🛠️ Alternative Option: UptimeRobot (Free Forever)

If you prefer [UptimeRobot](https://uptimerobot.com):

1. Go to [https://uptimerobot.com](https://uptimerobot.com) and create a free account.
2. Click **"+ Add New Monitor"**.
3. Configure the monitor:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Techware Render API`
   - **URL (or IP)**: `https://techwareautomationindia-backend.onrender.com/api/health`
   - **Monitoring Interval**: `5 minutes` (or `10 minutes`)
4. Click **"Create Monitor"**.

---

## ✅ How to Verify It's Working

1. Open your [Render Dashboard](https://dashboard.render.com).
2. Go to your backend service: `techwareautomationindia-backend`.
3. Click on the **Logs** tab.
4. Within 10 minutes, you will see periodic incoming `GET /api/health` requests with a `200 OK` response.
5. Your service status will stay green and **will never go to sleep**.
