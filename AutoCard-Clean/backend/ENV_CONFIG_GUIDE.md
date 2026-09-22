# Environment Configuration Guide

This guide explains how to configure the backend using environment variables for different deployment environments.

## Files

- **.env** - Local development configuration
- **.env.production** - Production deployment configuration  
- **.env.example** - Template file (for reference, not used)

## Environment Variables

### DATABASE_URL
Database connection string in the format:
\\\
mysql://username:password@host:port/database_name
\\\

**Local:** Uses localhost MySQL (XAMPP)  
**Production:** Uses Hostinger MySQL

### PORT
Server port number (default: 4000 for local, 4001 for production)

### NODE_ENV
Environment mode: \development\ or \production\

### ALLOWED_ORIGINS
**Most Important for CORS!**

Comma-separated list of allowed frontend URLs. The backend will only accept API requests from these domains.

**Local Development:**
\\\
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"
\\\

**Production:**
\\\
ALLOWED_ORIGINS="https://your-domain.com,https://www.your-domain.com"
\\\

### ALLOW_VERCEL_PREVIEWS
Set to \"true"\ to allow ALL Vercel preview deployments (any \*.vercel.app\ domain).

**When to use:**
- ✅ Enable in production if you deploy preview branches to Vercel
- ❌ Disable in local development (not needed)

### ALLOW_HOSTINGER_SITES
Set to \"true"\ to allow ALL Hostinger sites (\*.hostinger.site\, \*.hostingersite.com\).

**When to use:**
- ✅ Enable if you use Hostinger for staging/testing
- ❌ Disable if you don't use Hostinger

### JWT_SECRET
Secret key for signing JWT tokens. **Must be different for production!**

### JWT_EXPIRES_IN
Token expiration time (e.g., \"7d"\ for 7 days)

### EMAIL_USER, EMAIL_PASS, EMAIL_TO
Gmail SMTP configuration for sending emails.

## Usage

### Local Development

1. Use the \.env\ file (already configured)
2. Make sure MySQL is running (XAMPP)
3. Start backend: \
pm run dev\
4. Backend will use: http://localhost:4000

### Production Deployment

#### Option 1: Hostinger (Manual .env file)

1. Upload \.env.production\ to your server
2. Rename it to \.env\
3. Update values as needed
4. Restart your Node.js app

#### Option 2: Vercel (Environment Variables UI)

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable from \.env.production\:
   - Variable name: \ALLOWED_ORIGINS\
   - Value: \https://your-frontend.vercel.app\
3. Click "Save"
4. Redeploy your app

## How CORS Works

The backend checks incoming requests:

\\\
Frontend Request → Backend CORS Check → Allow/Deny

1. Check exact match in ALLOWED_ORIGINS
2. If ALLOW_VERCEL_PREVIEWS="true", allow *.vercel.app
3. If ALLOW_HOSTINGER_SITES="true", allow *.hostinger.site
4. Otherwise, DENY the request
\\\

## Example Configurations

### Local Development Only
\\\env
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"
ALLOW_VERCEL_PREVIEWS="false"
ALLOW_HOSTINGER_SITES="false"
\\\

### Production with Specific Domains
\\\env
ALLOWED_ORIGINS="https://myapp.com,https://www.myapp.com"
ALLOW_VERCEL_PREVIEWS="false"
ALLOW_HOSTINGER_SITES="false"
\\\

### Production with Vercel Previews Enabled
\\\env
ALLOWED_ORIGINS="https://myapp.com"
ALLOW_VERCEL_PREVIEWS="true"  # Allows any *.vercel.app
ALLOW_HOSTINGER_SITES="false"
\\\

## Security Best Practices

1. ✅ **Never commit .env or .env.production to Git**  
   (They're in .gitignore)

2. ✅ **Use strong, unique JWT_SECRET in production**  
   Generate with: \
ode -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\

3. ✅ **Only allow necessary origins**  
   Don't enable wildcard patterns unless needed

4. ✅ **Different credentials for each environment**  
   Use separate database users for local/production

5. ✅ **Review CORS logs in production**  
   Check for blocked origins that should be allowed

## Troubleshooting

### Frontend can't connect to backend

**Check:**
1. Is the frontend URL in \ALLOWED_ORIGINS\?
2. Are you using \http://\ for local and \https://\ for production?
3. Check backend logs for "CORS blocked origin" messages

### Vercel preview deployment blocked

**Fix:** Set \ALLOW_VERCEL_PREVIEWS="true"\ in production

### Backend won't start

**Check:**
1. Is PORT already in use?
2. Is DATABASE_URL correct?
3. Check for syntax errors in .env file (no spaces around =)

## Need Help?

Check the backend logs when starting:
\\\
🌐 Environment: development
🌐 Allowed CORS origins: [ 'http://localhost:5173', 'http://localhost:5174' ]
🌐 Vercel preview deployments: ENABLED
\\\

This shows exactly which origins are allowed.
