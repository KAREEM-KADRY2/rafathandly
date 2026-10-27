@echo off
chcp 65001 > nul
title نظام الحاج رفعت
color 0b
echo ============================================================
echo               نظام الحاج رفعت - إدارة الحسابات
echo ============================================================
echo.
echo  [1/2] جاري تشغيل المحرك وقاعدة البيانات...
echo  [2/2] سيتم فتح المتصفح تلقائياً فور اكتمال الجاهزية...
echo.
echo  (تنبيه هام: يرجى ترك هذه النافذة مفتوحة أثناء استخدام النظام)
echo ============================================================
echo.

cd /d "%~dp0"
set OPEN_BROWSER=true

:: Kill any old lingering node instances so port 5000 is clean
taskkill /F /IM node.exe >nul 2>&1

if exist "runtime\node.exe" (
    "runtime\node.exe" index.js
) else (
    cd backend
    node index.js
)
pause
