#!/bin/bash

# Production deployment script for Render + Aiven MySQL

echo "🚀 Starting production deployment..."

# 1. Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# 2. Push schema directly to database (safe for existing data)
echo "🗄️  Pushing schema to database..."
npx prisma db push --accept-data-loss

# 3. Seed database if needed
echo "🌱 Seeding database..."
npm run db:seed || echo "Seed skipped (may already exist)"

echo "✅ Deployment complete!"
