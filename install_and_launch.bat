@echo off
REM Quick install and launch for Mobile Invoice OCR APK
cd /d %~dp0android
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell monkey -p com.mobileinvoice.ocr -c android.intent.category.LAUNCHER 1
pause
