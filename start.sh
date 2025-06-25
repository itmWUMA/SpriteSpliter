#!/bin/bash
cd sprite-spliter-app
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
echo "Starting development server..."
npm run dev