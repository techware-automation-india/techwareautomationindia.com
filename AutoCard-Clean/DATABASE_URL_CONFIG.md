# DATABASE_URL Configuration for Hostinger

## Problem: "PANIC: timer has gone away"

This error occurs when MySQL connections timeout on Hostinger's shared hosting environment.

## Solution: Update DATABASE_URL with Connection Pool Settings

### Format:

```
mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE?connection_limit=5&pool_timeout=10&connect_timeout=30
```

### Example:

```
mysql://u123456_user:YourPassword@localhost:3306/u123456_autocard?connection_limit=5&pool_timeout=10&connect_timeout=30
```

### Parameters Explained:

1. **connection_limit=5**
   - Limits concurrent connections to 5
   - Prevents exhausting Hostinger's connection limit
   - Shared hosting typically allows 5-10 connections

2. **pool_timeout=10**
   - Wait 10 seconds for available connection
   - Prevents immediate failures during high traffic

3. **connect_timeout=30**
   - Give 30 seconds to establish connection
   - Helps with slow Hostinger MySQL responses

### Additional Options (If Needed):

```
?connection_limit=5&pool_timeout=10&connect_timeout=30&socket_timeout=60
```

- **socket_timeout=60**: Keep connection alive for 60 seconds

## How to Update in Hostinger:

### Step 1: Get Your Current DATABASE_URL

From Hostinger → Databases → Your Database:
- Host: `localhost` (or IP address)
- Port: `3306`
- Database: `u123456_autocard` (your database name)
- Username: `u123456_user` (your username)
- Password: `YourPassword` (your password)

### Step 2: Format with Connection Pool Settings

```
mysql://u123456_user:YourPassword@localhost:3306/u123456_autocard?connection_limit=5&pool_timeout=10&connect_timeout=30
```

**Important**: Replace:
- `u123456_user` → Your actual username
- `YourPassword` → Your actual password
- `u123456_autocard` → Your actual database name

### Step 3: Update Environment Variable

1. Go to Hostinger → Your Backend App → **Settings**
2. Find **Environment Variables**
3. Update `DATABASE_URL` with the new connection string
4. Click **Save**
5. **Redeploy** the application

### Step 4: Verify

After redeployment, check Runtime Logs for:

✅ Success:
```
🚀 Server running on port 4000
Environment: production
✅ Database connected successfully.
🔄 Database health check started
```

❌ Still failing:
```
❌ Database connection failed: PANIC: timer has gone away
```

If still failing, try:
1. Increase `pool_timeout` to 20
2. Reduce `connection_limit` to 3
3. Add `socket_timeout=120`

## Additional Backend Improvements

The backend now includes:

1. **Connection Health Check**
   - Checks database every 5 minutes
   - Auto-reconnects if connection drops
   - Prevents "timer has gone away" errors

2. **Better Logging**
   - Shows connection status
   - Helps debug issues
   - Production-optimized

3. **Graceful Error Handling**
   - Server stays running during DB issues
   - Auto-recovery when DB comes back
   - No 503 errors from temporary failures

## Hostinger MySQL Limits

Be aware of Hostinger's limits:
- **Max connections**: Usually 5-10 (shared hosting)
- **Connection timeout**: ~60 seconds idle
- **Query timeout**: ~30 seconds

Our settings are optimized for these limits.

## Alternative: Use External MySQL

If issues persist on Hostinger MySQL, consider:
1. **Aiven.io** - Free tier, better reliability
2. **PlanetScale** - Free tier, serverless
3. **Railway** - Free tier with MySQL

Update DATABASE_URL to external service:
```
mysql://user:pass@external-host.aiven.io:12345/defaultdb?ssl-mode=REQUIRED&connection_limit=5
```

## Testing DATABASE_URL

To test locally:
1. Create `.env.production.local`
2. Add your Hostinger DATABASE_URL
3. Run: `NODE_ENV=production npm start`
4. Should connect successfully

## Common Errors:

### "Access denied for user"
- Wrong username or password
- Check Hostinger database credentials

### "Unknown database"
- Database name is wrong
- Verify in Hostinger → Databases

### "Can't connect to MySQL server"
- Host is wrong (use `localhost` on Hostinger)
- Port is wrong (use `3306`)

### "Too many connections"
- Reduce `connection_limit` to 3
- Check if other apps are using connections

---

**After updating DATABASE_URL, always redeploy!**

