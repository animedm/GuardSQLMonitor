@echo off
echo GuardSQL Monitor - Installation Script
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [31mNode.js is not installed. Please install Node.js 20+ first.[0m
    echo Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo [32mNode.js detected[0m
node -v
echo.

REM Check if .env exists
if not exist .env (
    echo [33mCreating .env file from example...[0m
    copy .env.example .env
    echo [32m.env file created[0m
    echo [33mPlease edit .env to configure your database connections[0m
    echo.
) else (
    echo [32m.env file already exists[0m
    echo.
)

REM Install backend dependencies
echo [36mInstalling backend dependencies...[0m
call npm install
if %errorlevel% neq 0 (
    echo [31mFailed to install backend dependencies[0m
    pause
    exit /b 1
)
echo [32mBackend dependencies installed[0m
echo.

REM Build backend
echo [36mBuilding backend...[0m
call npm run build
if %errorlevel% neq 0 (
    echo [31mFailed to build backend[0m
    pause
    exit /b 1
)
echo [32mBackend built successfully[0m
echo.

REM Install frontend dependencies
echo [36mInstalling frontend dependencies...[0m
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [31mFailed to install frontend dependencies[0m
    pause
    exit /b 1
)
echo [32mFrontend dependencies installed[0m
echo.

REM Build frontend
echo [36mBuilding frontend...[0m
call npm run build
if %errorlevel% neq 0 (
    echo [31mFailed to build frontend[0m
    pause
    exit /b 1
)
echo [32mFrontend built successfully[0m
echo.

cd ..

echo ==========================================
echo [32mInstallation Complete![0m
echo ==========================================
echo.
echo Next steps:
echo 1. Edit .env file with your database credentials
echo.
echo 2. Start the backend:
echo    npm start
echo.
echo 3. In another terminal, serve the frontend:
echo    cd frontend
echo    npm run preview
echo.
echo 4. Or use Docker:
echo    docker-compose up -d
echo.
echo 5. Access the dashboard:
echo    http://localhost:3000
echo.
echo For more information, see:
echo    - README.md
echo    - SETUP.md
echo    - QUICKSTART.md
echo.

pause
