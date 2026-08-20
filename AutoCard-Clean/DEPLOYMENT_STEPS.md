# 🚀 Deployment Steps - Roles & Access Integration

## Problem Solved
Fixed MySQL strict mode error: `BLOB, TEXT, GEOMETRY or JSON column 'role' can't have a default value`

## Solution Applied
1. ✅ Removed `@default(CUSTOMER)` from `User.role` field in `schema.prisma`
2. ✅ Deleted old SQLite migrations (incompatible with MySQL)
3. ✅ Created `npm run deploy` script for production
4. ✅ Committed and pushed changes

## Next Steps - Update Render Configuration

### 1. Login to Render Dashboard
Go to: https://dashboard.render.com

### 2. Select Your Backend Service
- Find: `techwareautomationindia-backend`
- Click on it

### 3. Update Build Command
Go to **Settings** → **Build & Deploy**

**Current Build Command:**
```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

**Change to:**
```bash
npm install && npm run deploy
```

### 4. Trigger Manual Deploy
- Click **Manual Deploy** → **Deploy latest commit**
- Wait for deployment to complete (2-3 minutes)

### 5. Verify Deployment
Check logs for:
```
✅ Prisma Client generated
✅ Database schema synced
✅ Seeded ADMIN: admin@techware.com
✅ Seeded EMPLOYEE: employee@techware.com
✅ Seeded CUSTOMER: customer@techware.com
```

## Test Login

### Production URL
Frontend: `https://techwareautomationindia-com-*.vercel.app`

### Test Credentials
**Admin:**
- Email: `admin@techware.com`
- Password: `admin123`

**Employee:**
- Email: `employee@techware.com`
- Password: `employee123`

## Roles & Access Module

### Backend API Endpoints (Already Built)
✅ `GET /api/roles-access` - Get all role permissions
✅ `GET /api/roles-access/:role` - Get specific role permissions
✅ `PUT /api/roles-access/:role/:moduleKey` - Update role permission
✅ `POST /api/roles-access/seed` - Seed default permissions

### Frontend Component
✅ File: `frontend/src/admin/pages/RolesAccess.jsx`
- Admin can view all module permissions
- Admin can grant/revoke access per role
- Real-time updates via API

### How It Works
1. Admin logs in → goes to Admin Panel
2. Clicks "Roles & Access" in sidebar
3. Sees all modules (Dashboard, Employees, Attendance, etc.)
4. For each role (ADMIN, EMPLOYEE, CUSTOMER):
   - ✅ Green = Access granted
   - ❌ Red = Access denied
5. Admin clicks checkbox to grant/revoke access
6. Changes saved to database immediately

## Database Schema

### `access_controls` Table
```prisma
model AccessControl {
  id         String   @id @default(uuid())
  role       Role     // ADMIN, EMPLOYEE, CUSTOMER
  moduleKey  String   // dashboard, employees, etc.
  canView    Boolean  @default(false)
  canCreate  Boolean  @default(false)
  canEdit    Boolean  @default(false)
  canDelete  Boolean  @default(false)
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Vercel (Frontend)                      │
│  https://techwareautomationindia-com-*.vercel.app│
└────────────────┬────────────────────────────────┘
                 │ HTTPS
                 ↓
┌─────────────────────────────────────────────────┐
│     Render.com (Backend Node/Express)           │
│  https://techwareautomationindia-backend...     │
│                                                  │
│  Routes:                                         │
│  - /api/auth/login                               │
│  - /api/roles-access                             │
│  - /api/employees                                │
│  - /api/attendance                               │
└────────────────┬────────────────────────────────┘
                 │ Prisma
                 ↓
┌─────────────────────────────────────────────────┐
│        Aiven MySQL (Production DB)              │
│  autocard-mysql-info-e690.f.aivencloud.com      │
└─────────────────────────────────────────────────┘
```

## Troubleshooting

### If Login Still Fails
1. Check Render logs: `https://dashboard.render.com/web/YOUR_SERVICE/logs`
2. Look for:
   - `✅ Database connected`
   - `✅ Server running on port 4000`
3. If tables don't exist, run manually in Render Shell:
   ```bash
   npm run deploy
   ```

### If Seed Fails
Run manually in Render Shell:
```bash
node prisma/seed.js
```

### Check Database Tables
Run in Render Shell:
```bash
npx prisma studio
```

## Files Changed
- ✅ `backend/prisma/schema.prisma` - Removed role default
- ✅ `backend/package.json` - Added deploy script
- ✅ `backend/deploy-production.sh` - Deployment script
- ✅ Deleted `backend/prisma/migrations/*` - Old SQLite migrations

## Commit Message
```
fix: remove role default for MySQL strict mode compatibility

- Remove @default(CUSTOMER) from User.role field
- Delete SQLite migrations incompatible with MySQL
- Add npm run deploy script for production
- Use db push instead of migrate for existing data
```

---

## 🎉 What's Working Now

1. ✅ **CORS Fixed** - Vercel frontend can talk to Render backend
2. ✅ **MySQL Connection** - Render connects to Aiven MySQL
3. ✅ **Schema Fix** - Removed enum default causing strict mode error
4. ✅ **Deployment Ready** - Just need to update Render build command

## 🎯 Final Step

**Just update Render build command to: `npm install && npm run deploy`**

Then your Roles & Access module will work in production! 🚀
