@echo off
echo.
echo ================================
echo   Connecting to MySQL Database
echo ================================
echo.
echo Database: techware_db
echo User: root
echo.
cd C:\xampp\mysql\bin
mysql -u root -pAyushraj@123 -e "USE techware_db; SHOW TABLES;"
echo.
echo ================================
echo   Connection Successful!
echo ================================
echo.
echo To browse data, run these commands:
echo   mysql -u root -pAyushraj@123
echo   USE techware_db;
echo   SELECT * FROM User;
echo.
pause
