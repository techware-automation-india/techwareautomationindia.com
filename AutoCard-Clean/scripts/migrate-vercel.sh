#!/bin/bash
# Script to run Prisma migrations on Vercel Postgres
# Run this locally after setting DATABASE_URL from Vercel

echo "Running Prisma migrations for Vercel Postgres..."

# Navigate to backend directory
cd backend

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Optional: Run seed if needed
# echo "Seeding database..."
# node prisma/seed.js

echo "✅ Migration complete!"
echo "Your Vercel Postgres database is ready."
