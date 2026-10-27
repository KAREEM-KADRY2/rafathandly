const fs = require('fs');

const desktopBat = `@echo off
chcp 65001 > nul
title نظام الحاج رفعت

if exist "C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت\\Start-AlHajjRefaat.exe" (
    cd /d "C:\\Users\\xps\\Desktop\\الحاج رفعت - نسخة العميل\\الحاج رفعت"
    start "" "Start-AlHajjRefaat.exe"
    exit
)

if exist "C:\\Users\\xps\\Desktop\\خاص\\الحاج رفعت\\Start-AlHajjRefaat.exe" (
    cd /d "C:\\Users\\xps\\Desktop\\خاص\\الحاج رفعت"
    start "" "Start-AlHajjRefaat.exe"
    exit
)

if exist "C:\\Users\\xps\\Desktop\\الحاج رفعت\\الحاج رفعت\\Start-AlHajjRefaat.exe" (
    cd /d "C:\\Users\\xps\\Desktop\\الحاج رفعت\\الحاج رفعت"
    start "" "Start-AlHajjRefaat.exe"
    exit
)
`;

const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync('C:/Users/xps/Desktop/تشغيل_نظام_الحاج_رفعت.bat', Buffer.concat([bom, Buffer.from(desktopBat.replace(/\n/g, '\r\n'), 'utf8')]));
console.log('Updated C:/Users/xps/Desktop/تشغيل_نظام_الحاج_رفعت.bat');
