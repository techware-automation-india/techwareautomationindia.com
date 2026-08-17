@echo off
REM Script to run Prisma migrations on Vercel Postgres (Windows)
REM Run this locally after setting DATABASE_URL from Vercel

echo Running Prisma migrations for Vercel Postgres...

cd backend

echo Generating Prisma Client...
call npx prisma generate

echo Running database migrations...
call npx prisma migrate deploy

REM Optional: Run seed if needed
REM echo Seeding database...
REM call node prisma/seed.js

echo.
echo Migration complete!
echo Your Vercel Postgres database is ready.
pause
