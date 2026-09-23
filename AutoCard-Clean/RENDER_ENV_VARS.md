# Render.com Environment Variables - Quick Reference

## 🚀 Required Environment Variables for Render

Copy these to **Render Dashboard → Your Service → Environment**:

### 1. Database Connection (CRITICAL)
```bash
DATABASE_URL=mysql://avnadmin:YOUR_ACTUAL_AIVEN_PASSWORD@autocard-mysql-info-e690.f.aivencloud.com:12716/defaultdb?connection_limit=3&pool_timeout=20&connect_timeout=30
```

**Note**: Replace `YOUR_ACTUAL_AIVEN_PASSWORD` with the real password from Aiven Console.

The log shows your database is at: `autocard-mysql-info-e690.f.aivencloud.com:12716`

---

### 2. CORS Configuration (CRITICAL - Fixes CORS Error)
```bash
ALLOWED_ORIGINS=https://techware-automation-india.vercel.app,https://techwareautomationindia.vercel.app
```

Add BOTH URLs if you have multiple Vercel deployments.

---

### 3. Enable Vercel Previews (Optional but Recommended)
```bash
ALLOW_VERCEL_PREVIEWS=true
```

This allows preview deployments to work without adding each URL.

---

### 4. JWT Secret (CRITICAL - Security)
```bash
JWT_SECRET=super_secret_jwt_key_minimum_32_characters_please_change_this_to_random_string_abc123xyz789
```

**IMPORTANT**: Generate a strong random string (32+ characters) for production!

---

### 5. Server Configuration
```bash
NODE_ENV=production
PORT=4000
```

---

### 6. Email Configuration (Optional)
```bash
EMAIL_USER=ak0462463@gmail.com
EMAIL_PASS=epbfnrruwzrgiigy
```

---

## 📋 Complete Environment Variables List

Copy and paste this into Render Environment section:

```bash
DATABASE_URL=mysql://avnadmin:YOUR_ACTUAL_PASSWORD@autocard-mysql-info-e690.f.aivencloud.com:12716/defaultdb?connection_limit=3&pool_timeout=20&connect_timeout=30
JWT_SECRET=change_this_to_a_very_long_random_secret_string_minimum_32_characters_for_security
ALLOWED_ORIGINS=https://techware-automation-india.vercel.app,https://techwareautomationindia.vercel.app
ALLOW_VERCEL_PREVIEWS=true
NODE_ENV=production
PORT=4000
EMAIL_USER=ak0462463@gmail.com
EMAIL_PASS=epbfnrruwzrgiigy
```

---

## 🔑 How to Get Aiven Database Password

1. Go to **Aiven Console**: https://console.aiven.io
2. Click on your **MySQL service** (autocard-mysql-info-e690)
3. Go to **Overview** tab
4. Find **Connection information**
5. Copy the **Password**
6. Replace `YOUR_ACTUAL_PASSWORD` in `DATABASE_URL` above

---

## 🎯 How to Generate Strong JWT Secret

### Option 1: PowerShell (Windows)
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

### Option 2: Online Generator
Visit: https://www.grc.com/passwords.htm
Use the "63 random alphanumeric characters" option

### Option 3: Node.js
```javascript
require('crypto').randomBytes(32).toString('hex')
```

---

## ⚠️ Common Mistakes to Avoid

1. ❌ Don't use quotes around environment variable values in Render
   - ✅ Correct: `PORT=4000`
   - ❌ Wrong: `PORT="4000"`

2. ❌ Don't include spaces around `=`
   - ✅ Correct: `NODE_ENV=production`
   - ❌ Wrong: `NODE_ENV = production`

3. ❌ Don't forget to redeploy after changing env vars
   - Always click "Manual Deploy" after saving changes

4. ❌ Don't forget the Vercel URL in ALLOWED_ORIGINS
   - This is the #1 cause of CORS errors!

---

## 🔍 Troubleshooting

### If deployment fails with database error:
- Check password is correct (copy from Aiven)
- Check database URL format is correct
- Verify Aiven service is running

### If you get CORS error on Vercel:
- Check ALLOWED_ORIGINS includes your exact Vercel URL
- Check no trailing slash in the URL
- Try adding ALLOW_VERCEL_PREVIEWS=true

### If login doesn't work:
- Check JWT_SECRET is set
- Check it's at least 32 characters
- Redeploy after changing it

---

## ✅ Verification After Deployment

1. **Check Backend Health**:
   ```
   https://techwareautomationindia-backend.onrender.com/api/health
   ```
   Should return: `{"status":"OK","server":"running"}`

2. **Check Database Connection** in Render logs:
   Look for: `✅ Database connected successfully.`

3. **Check CORS Configuration** in Render logs:
   Look for: `🌐 Allowed CORS origins: https://techware-automation-india.vercel.app`

4. **Test Login on Vercel**:
   - Go to your Vercel URL
   - Try logging in with: `admin@techware.com` / `admin123`
   - Should work without CORS error

---

## 📞 Need Help?

If you're still having issues:
1. Check Render deployment logs for errors
2. Check Render live logs for runtime errors
3. Check browser console for CORS errors
4. Verify all environment variables are set correctly

---

**Last Updated**: 2024
**For**: Techware Automation India - Production Deployment
