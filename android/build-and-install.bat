@echo off
echo ====================================
echo Mobile Invoice OCR - Build ^& Install
echo ====================================
echo.

echo [1/3] Cleaning previous build...
call gradlew clean
if %errorlevel% neq 0 goto error

echo.
echo [2/3] Building debug APK...
call gradlew assembleDebug
if %errorlevel% neq 0 goto error

echo.
echo [3/3] Installing on device...
adb install -r app\build\outputs\apk\debug\app-debug.apk
if %errorlevel% neq 0 goto error

echo.
echo ====================================
echo SUCCESS! App installed on device.
echo ====================================
echo.
echo Launching app...
adb shell am start -n com.mobileinvoice.ocr/.MainActivity
goto end

:error
echo.
echo ====================================
echo ERROR! Build or install failed.
echo ====================================
echo.

:end
pause
