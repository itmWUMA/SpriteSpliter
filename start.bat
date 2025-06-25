@echo off
cd sprite-spliter-app
IF NOT EXIST node_modules (
    echo Installing dependencies...
    npm install
)
echo Starting development server...
npm run dev