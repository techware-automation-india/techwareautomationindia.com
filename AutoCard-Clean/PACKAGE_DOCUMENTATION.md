# Package.json Documentation

## AutoCard Application - Dependencies & Scripts Guide

---

## 📦 Backend Package.json

### Basic Information
```json
{
  "name": "techware-automation-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Backend API for Techware Automation India",
  "main": "src/index.js"
}
```

### Engine Requirements
```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```
- **Node.js**: Version 18 or higher required
- **npm**: Version 9 or higher required
- Ensures compatibility with hosting platforms

---

### Scripts

#### Development Scripts
```bash
npm run dev
# Starts server with nodemon (auto-restart on file changes)
# Use this during development
```

#### Production Scripts
```bash
npm start
# Starts server with node (no auto-restart)
# Use this for production deployment
```

#### Database Scripts
```bash
npm run prisma:generate
# Generates Prisma Client from schema

npm run prisma:migrate
# Creates and applies database migrations

npm run prisma:studio
# Opens Prisma Studio (database GUI)

npm run db:seed
# Seeds the database with initial data
```

#### Deployment Script
```bash
npm run deploy
# Full deployment process:
# 1. Generates Prisma Client
# 2. Pushes database schema
# 3. Seeds the database
```

#### Post Install
```bash
# Runs automatically after npm install
npm run postinstall
# Generates Prisma Client
```

---

### Dependencies

#### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.19.2 | Web framework for Node.js |
| `cors` | ^2.8.5 | Enable CORS for cross-origin requests |
| `dotenv` | ^16.4.5 | Load environment variables from .env |

#### Database & ORM
| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | ^5.19.1 | Prisma ORM client |
| `mysql2` | ^3.11.0 | MySQL database driver |

#### Authentication & Security
| Package | Version | Purpose |
|---------|---------|---------|
| `bcryptjs` | ^2.4.3 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT token generation/verification |
| `express-rate-limit` | ^7.4.0 | Rate limiting for API protection |

#### File Handling
| Package | Version | Purpose |
|---------|---------|---------|
| `multer` | ^1.4.5-lts.1 | File upload handling |

#### Email & Scheduling
| Package | Version | Purpose |
|---------|---------|---------|
| `nodemailer` | ^6.9.14 | Send emails |
| `node-cron` | ^3.0.3 | Schedule cron jobs |

#### Validation
| Package | Version | Purpose |
|---------|---------|---------|
| `zod` | ^3.23.8 | Schema validation |

---

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `nodemon` | ^3.1.4 | Auto-restart server on file changes |
| `prisma` | ^5.19.1 | Prisma CLI and dev tools |

---

### Backend Installation

```bash
cd backend

# Install all dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

---

## 📦 Frontend Package.json

### Basic Information
```json
{
  "name": "techware-automation",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
```

---

### Scripts

#### Development Script
```bash
npm run dev
# Starts Vite development server with HMR (Hot Module Replacement)
# Opens at http://localhost:5173
```

#### Build Scripts
```bash
npm run build
# Creates optimized production build in dist/ folder

npm run vercel-build
# Special build command for Vercel deployment
# (Same as npm run build)
```

#### Preview Script
```bash
npm run preview
# Preview production build locally
# Test before deploying
```

#### Linting
```bash
npm run lint
# Run ESLint to check code quality
```

---

### Dependencies

#### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | React library (stable LTS) |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `react-router-dom` | ^6.26.2 | Client-side routing |

#### UI Components & Styling
| Package | Version | Purpose |
|---------|---------|---------|
| `lucide-react` | ^0.441.0 | Icon components |
| `react-icons` | ^5.3.0 | Additional icon library |
| `tailwind-merge` | ^2.5.2 | Merge Tailwind classes |
| `clsx` | ^2.1.1 | Conditional className utility |

#### Animation
| Package | Version | Purpose |
|---------|---------|---------|
| `framer-motion` | ^11.5.4 | Animation library |

#### Form Components
| Package | Version | Purpose |
|---------|---------|---------|
| `react-select` | ^5.8.0 | Advanced select component |
| `country-state-city` | ^3.2.1 | Country/state/city data |

#### API & Communication
| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | ^1.7.2 | HTTP client for API requests |
| `@emailjs/browser` | ^4.4.1 | Client-side email sending |

#### Notifications
| Package | Version | Purpose |
|---------|---------|---------|
| `sonner` | ^1.5.0 | Toast notifications |

---

### Dev Dependencies

#### Build Tool
| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^5.4.3 | Fast build tool and dev server |
| `@vitejs/plugin-react` | ^4.3.1 | React plugin for Vite |

#### CSS Framework
| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^3.4.10 | Utility-first CSS framework |
| `autoprefixer` | ^10.4.20 | Add vendor prefixes to CSS |
| `postcss` | ^8.4.45 | CSS transformation tool |
| `tailwindcss-animate` | ^1.0.7 | Tailwind animation utilities |

#### Linting & Type Checking
| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^9.9.1 | JavaScript linter |
| `@eslint/js` | ^9.9.1 | ESLint JavaScript plugin |
| `eslint-plugin-react-hooks` | ^4.6.2 | React Hooks linting rules |
| `eslint-plugin-react-refresh` | ^0.4.11 | React Fast Refresh linting |
| `globals` | ^15.9.0 | Global variables definitions |
| `@types/react` | ^18.3.5 | TypeScript types for React |
| `@types/react-dom` | ^18.3.0 | TypeScript types for React DOM |

---

### Frontend Installation

```bash
cd frontend

# Install all dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🔄 Version Comparison

### Why We Updated Packages

#### Backend Updates
| Package | Old Version | New Version | Reason |
|---------|------------|-------------|--------|
| Prisma | 6.1.0 | 5.19.1 | Stable LTS, better hosting support |
| MySQL | mysql 2.18.1 | mysql2 3.11.0 | Deprecated → Recommended |
| multer | 2.2.0 | 1.4.5-lts.1 | Stable LTS version |
| node-cron | 4.5.0 | 3.0.3 | Stable, fewer breaking changes |
| nodemailer | 9.0.1 | 6.9.14 | Stable, widely tested |
| express-rate-limit | 8.5.2 | 7.4.0 | Stable version |

#### Frontend Updates
| Package | Old Version | New Version | Reason |
|---------|------------|-------------|--------|
| React | 19.2.6 | 18.3.1 | Stable LTS, better library support |
| Vite | 8.0.12 | 5.4.3 | Stable, production-ready |
| axios | 1.18.1 | 1.7.2 | Stable version |
| framer-motion | 12.38.0 | 11.5.4 | Stable, fewer bugs |
| react-router-dom | 7.15.0 | 6.26.2 | Stable LTS |
| lucide-react | 1.14.0 | 0.441.0 | Stable version |
| sonner | 2.0.7 | 1.5.0 | Stable version |

---

## 📝 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/database"

# JWT
JWT_SECRET="your-secret-key-here"

# Server
PORT=4001
NODE_ENV=development

# Email (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```env
# API URL
VITE_API_URL=http://localhost:4001/api

# Other configs
VITE_APP_NAME=Techware Automation
```

---

## 🚀 Deployment Guide

### Backend Deployment

#### Option 1: Railway / Render
1. Push code to Git repository
2. Connect repository to Railway/Render
3. Set environment variables in dashboard
4. Add build command: `npm run deploy`
5. Add start command: `npm start`

#### Option 2: VPS / Cloud Server
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
git clone your-repo-url
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
nano .env  # Edit with your values

# Deploy
npm run deploy

# Start with PM2 (process manager)
npm install -g pm2
pm2 start src/index.js --name "autocard-api"
pm2 startup
pm2 save
```

### Frontend Deployment

#### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Set environment variables in Vercel dashboard
# Production deploy
vercel --prod
```

#### Option 2: Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

#### Option 3: Static Hosting (Apache/Nginx)
```bash
# Build
npm run build

# Copy dist/ folder to web server
scp -r dist/* user@server:/var/www/html/
```

---

## 🔧 Troubleshooting

### Backend Issues

#### Port Already in Use
```bash
# Kill process on port 4001
# Windows
netstat -ano | findstr :4001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:4001 | xargs kill -9
```

#### Prisma Client Not Generated
```bash
npm run prisma:generate
```

#### Database Connection Error
- Check DATABASE_URL in .env
- Verify MySQL is running
- Check firewall settings

### Frontend Issues

#### Dependencies Not Installing
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Build Errors
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run build
```

#### API Connection Error
- Check VITE_API_URL in .env
- Verify backend is running
- Check CORS settings

---

## 📊 Package Size Analysis

### Backend
- **Total Dependencies**: 11 packages
- **Dev Dependencies**: 2 packages
- **Estimated Size**: ~50MB (including node_modules)

### Frontend
- **Total Dependencies**: 11 packages
- **Dev Dependencies**: 12 packages
- **Estimated Size**: ~300MB (including node_modules)
- **Built Size**: ~2-3MB (dist folder)

---

## 🔐 Security Best Practices

1. **Keep Dependencies Updated**
   ```bash
   npm outdated  # Check for updates
   npm update    # Update packages
   ```

2. **Audit for Vulnerabilities**
   ```bash
   npm audit
   npm audit fix
   ```

3. **Use .npmrc for Security**
   ```
   # .npmrc
   save-exact=true
   engine-strict=true
   ```

4. **Environment Variables**
   - Never commit .env files
   - Use different .env for dev/prod
   - Rotate secrets regularly

---

## 📚 Additional Resources

### Documentation Links
- [Express.js Docs](https://expressjs.com/)
- [Prisma Docs](https://www.prisma.io/docs)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### Learning Resources
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [React Best Practices](https://react.dev/learn)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

---

**Last Updated**: September 1, 2026

**Maintained By**: Development Team
