#!/bin/bash
set -e

DIST="release/comtest"

echo "=== comtest release ==="

# Build frontend
echo "[1/4] Building frontend..."
(cd client && npm run build)

# Clean and create release dir
echo "[2/4] Copying files..."
rm -rf release
mkdir -p "$DIST/server" "$DIST/client"

cp server/index.js server/burnProtocol.js "$DIST/server/"
cp -r client/dist "$DIST/client/"

# package.json for npm install
echo "[3/4] Writing package.json..."
cat > "$DIST/package.json" << 'PKGJSON'
{
  "name": "comtest",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.4",
    "serialport": "^12.0.0",
    "cors": "^2.8.5"
  }
}
PKGJSON

# Windows batch files
echo "[4/4] Writing start scripts..."
cat > "$DIST/install.bat" << 'EOF'
@echo off
echo Installing dependencies...
call npm install --production
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] npm install failed. Make sure Node.js is installed.
  echo Download from https://nodejs.org
  pause
  exit /b 1
)
echo.
echo Done! Now double-click start.bat to run.
pause
EOF

cat > "$DIST/start.bat" << 'EOF'
@echo off
if not exist node_modules (
  echo [ERROR] Dependencies not installed.
  echo Please run install.bat first.
  pause
  exit /b 1
)
echo Starting comtest server...
echo Open http://localhost:3000 in your browser
echo Press Ctrl+C to stop
echo.
start http://localhost:3000
node server\index.js
EOF

# macOS/Linux shell scripts
cat > "$DIST/install.sh" << 'EOF'
#!/bin/bash
set -e
echo "Installing dependencies..."
npm install --production
echo ""
echo "Done! Run ./start.sh to start."
EOF
chmod +x "$DIST/install.sh"

cat > "$DIST/start.sh" << 'EOF'
#!/bin/bash
if [ ! -d node_modules ]; then
  echo "Dependencies not installed. Run ./install.sh first."
  exit 1
fi
echo "Starting comtest server..."
echo "Open http://localhost:3000 in your browser"
echo "Press Ctrl+C to stop"
echo ""
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null
node server/index.js
EOF
chmod +x "$DIST/start.sh"

cat > "$DIST/README.txt" << 'EOF'
comtest - Serial Port Debug Tool
==================================

Requirements: Node.js 18+
  Download from https://nodejs.org

Setup (first time only):
  Windows: double-click install.bat
  macOS:   run ./install.sh

Run:
  Windows: double-click start.bat
  macOS:   run ./start.sh
  Then open http://localhost:3000 in your browser
EOF

# Zip
echo "Zipping..."
(cd release && zip -rq comtest.zip comtest/)

SIZE=$(du -sh release/comtest.zip | cut -f1)
echo ""
echo "=== Done: release/comtest.zip ($SIZE) ==="
echo ""
echo "Usage:"
echo "  Windows: install.bat → start.bat"
echo "  macOS:   ./install.sh → ./start.sh"
