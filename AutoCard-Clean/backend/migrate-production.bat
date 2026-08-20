@echo off
REM Script to migrate production Aiven MySQL database
REM Run this to create tables in your production database

echo ========================================
echo   Production Database Migration
echo ========================================
echo.
echo WARNING: This will apply migrations to your PRODUCTION Aiven MySQL database!
echo.
echo Before running this, make sure:
echo 1. You have your Aiven MySQL connection string
echo 2. You've updated .env.production with the correct DATABASE_URL
echo.
pause

echo.
echo Applying migrations to production database...
echo.

set DOTENV_CONFIG_PATH=.env.production
npx prisma migrate deploy

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Migration successful!
    echo ========================================
    echo.
    echo Your production database now has all tables.
    echo.
    echo Next step: Seed the database with initial users
    echo Run: npm run db:seed
    echo.
) else (
    echo.
    echo ========================================
    echo   Migration failed!
    echo ========================================
    echo.
    echo Check the error above and verify:
    echo 1. DATABASE_URL in .env.production is correct
    echo 2. You can connect to Aiven MySQL
    echo.
)

pause
