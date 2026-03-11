#!/bin/bash

echo "🛡️  GuardSQL Monitor - Installation Script"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env to configure your database connections"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
echo "✅ Backend dependencies installed"
echo ""

# Build backend
echo "🔨 Building backend..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build backend"
    exit 1
fi
echo "✅ Backend built successfully"
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
echo "✅ Frontend dependencies installed"
echo ""

# Build frontend
echo "🔨 Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build frontend"
    exit 1
fi
echo "✅ Frontend built successfully"
echo ""

cd ..

echo "=========================================="
echo "🎉 Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database credentials:"
echo "   nano .env"
echo ""
echo "2. Start the backend:"
echo "   npm start"
echo ""
echo "3. In another terminal, serve the frontend:"
echo "   cd frontend"
echo "   npm run preview"
echo ""
echo "4. Or use Docker:"
echo "   docker-compose up -d"
echo ""
echo "5. Access the dashboard:"
echo "   http://localhost:3000"
echo ""
echo "📖 For more information, see:"
echo "   - README.md"
echo "   - SETUP.md"
echo "   - QUICKSTART.md"
echo ""
