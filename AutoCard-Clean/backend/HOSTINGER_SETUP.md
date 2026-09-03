# Hostinger MySQL Database Setup Guide

## Problem: "PANIC: timer has gone away"

This error occurs when the MySQL connection times out on Hostinger shared hosting.

## Solution: Update DATABASE_URL with Proper Parameters

### Step 1: Get Your Hostinger MySQL Credentials

Login to Hostinger → Databases → MySQL Databases

You need:
- **Username**: (e.g., `u123456789_autocard`)
- **Password**: (your database password)
- **Host**: (e.g., `localhost` or `srv123.main-hosting.eu`)
- **Database Name**: (e.g., `u123456789_autocard`)
- **Port**: `3306` (default MySQL port)

### Step 2: Update .env.production

Replace the DATABASE_URL in `.env.production` with:

```bash
DATABASE_URL="mysql://USERNAME:PASSWORD@HOST:3306/DATABASE?connection_limit=3&pool_timeout=20&connect_timeout=30"
```

**Example:**
```bash
DATABASE_URL="mysql://u123456789_autocard:MyP@ssw0rd@srv123.main-hosting.eu:3306/u123456789_autocard?connection_limit=3&pool_timeout=20&connect_timeout=30"
```

### Step 3: Important Connection Parameters

- `connection_limit=3` - Limits concurrent connections (Hostinger has low limits)
- `pool_timeout=20` - How long to wait for a connection (seconds)
- `connect_timeout=30` - Initial connection timeout (seconds)

### Step 4: Deploy to Hostinger

1. Upload the updated code to Hostinger
2. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```
3. Restart the Node.js application

### Step 5: Test the Connection

Run this command on Hostinger terminal:
```bash
node -e "import('mysql2/promise').then(m => m.default.createConnection('mysql://USER:PASS@HOST:3306/DB').then(c => console.log('✅ Connected')))"
```

## Alternative: Use Unix Socket (If Available)

If your database is on the same server (localhost), you can use Unix socket for better performance:

```bash
DATABASE_URL="mysql://USERNAME:PASSWORD@localhost:3306/DATABASE?socket=/var/lib/mysql/mysql.sock&connection_limit=3"
```

## Troubleshooting

### Error: "Too many connections"
- Reduce `connection_limit` to 2 or 1
- Check if other apps are using the database

### Error: "Connection refused"
- Check if host, port, and credentials are correct
- Verify MySQL is running on Hostinger

### Error: "Access denied"
- Double-check username and password
- Ensure user has permissions on the database
- Check if remote access is enabled (if not on localhost)

## Production Checklist

- ✅ Update DATABASE_URL with correct Hostinger credentials
- ✅ Add connection parameters (connection_limit, pool_timeout, connect_timeout)
- ✅ Run `npx prisma generate` after changing DATABASE_URL
- ✅ Run `npx prisma migrate deploy` to apply migrations
- ✅ Restart Node.js application
- ✅ Check logs for "✅ Database connected successfully"
