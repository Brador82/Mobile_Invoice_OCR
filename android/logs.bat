@echo off
echo ====================================
echo Mobile Invoice OCR - Logcat Viewer
echo ====================================
echo Press Ctrl+C to stop.
echo.

adb logcat -c
adb logcat | findstr "mobileinvoice"
