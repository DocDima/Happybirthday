@echo off
echo ============================================
echo   Birthday Stars Bot - Starting...
echo ============================================
echo.

:: Проверяем Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js не установлен!
    echo Скачай: https://nodejs.org
    pause
    exit /b 1
)

:: Устанавливаем/обновляем зависимости
echo Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: npm install завершился с ошибкой!
    pause
    exit /b 1
)
echo.

:: Запускаем сервер
echo Starting bot server...
echo.
node server.js
echo.
echo Сервер остановлен.
pause
