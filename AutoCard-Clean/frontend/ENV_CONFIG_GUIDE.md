# Frontend Environment Configuration

## Files

- **\.env\** - Local development (points to localhost backend)
- **\.env.production\** - Production deployment (points to production backend)
- **\.env.example\** - Template file for reference

## Environment Variables

### VITE_API_URL

**Most Important Variable!**

This tells your frontend where to find the backend API.

**Local Development:**
\\\env
VITE_API_URL="http://localhost:4000"
\\\

**Production:**
\\\env
VITE_API_URL="https://api.techwareautomation.in"
\\\

### How It's Used in Code

The frontend uses this in \rontend/src/lib/api.js\:

\\\javascript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4001";
\\\

All API calls will be made to this URL:
- Login: \\/api/auth/login\
- Get employees: \\/api/employees\
- etc.

## Environment-Specific Behavior

### Local Development
\\\
Frontend (localhost:5173) → Backend (localhost:4000)
\\\

### Production
\\\
Frontend (vercel.app) → Backend (api.techwareautomation.in or render.com)
\\\

## Testing

### Local:
1. Make sure backend is running on \http://localhost:4000\
2. Start frontend: \
pm run dev\
3. Open browser console and check network tab
4. API calls should go to \http://localhost:4000/api/*\

### Production:
1. Deploy frontend to Vercel
2. Vercel automatically uses \.env.production\
3. API calls go to production backend URL

## Updating Production Backend URL

### If using Hostinger backend:
\\\env
VITE_API_URL="https://api.techwareautomation.in"
\\\

### If using Render backend:
\\\env
VITE_API_URL="https://techwareautomationindia-backend.onrender.com"
\\\

### If using Vercel backend:
\\\env
VITE_API_URL="https://your-backend.vercel.app"
\\\

## Vercel Deployment

When deploying to Vercel:

1. Vercel automatically detects \.env.production\
2. OR you can set environment variables in Vercel dashboard:
   - Go to: Project → Settings → Environment Variables
   - Add: \VITE_API_URL\ = \https://your-backend-url.com\
   - Save and redeploy

## Troubleshooting

### Frontend can't connect to backend

**Check:**
1. Is \VITE_API_URL\ correct?
2. Is backend actually running at that URL?
3. Are CORS settings correct on backend?
4. Check browser console for errors

### API calls going to wrong URL

**Check:**
1. Which \.env\ file is being used?
   - Local dev uses \.env\
   - Production uses \.env.production\
2. Did you restart the frontend after changing \.env\?

### CORS errors in browser

This means:
- Frontend URL is not in backend's \ALLOWED_ORIGINS\
- Update backend \.env\ to include your frontend URL

## Important Notes

1. ⚠️ **\VITE_\ prefix is required** for Vite to expose the variable
2. ⚠️ **Restart frontend** after changing \.env\ files
3. ⚠️ **Never commit \.env\ or \.env.production\** to Git (they're in \.gitignore\)
4. ✅ **Use \.env.example\** as a template for new team members

## Quick Reference

| Environment | Frontend URL | Backend URL (VITE_API_URL) |
|-------------|--------------|----------------------------|
| Local Dev | http://localhost:5173 | http://localhost:4000 |
| Production | https://vercel.app | https://api.techwareautomation.in |

---

**Need help?** Check the browser console Network tab to see where API calls are actually going.
